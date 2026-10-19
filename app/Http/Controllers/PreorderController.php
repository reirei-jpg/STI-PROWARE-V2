<?php

namespace App\Http\Controllers;

use App\Enums\PreorderStatus;
use App\Enums\ProductStatus;
use App\Http\Requests\UpdatePreorderCloseDateRequest;
use App\Models\Preorder;
use App\Models\Product;
use App\Models\ProductVariant;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The Specialist's Preorders page. Each Preorder product goes through
 * three stages: Taking preorders (students can still preorder), To order
 * (preorders closed: order that many in the eStore), and Arrived (the
 * product is for sale and the students who preordered were told). A product
 * for sale whose sold-out sizes students preordered is Waiting for restock
 * (order more in the eStore, or say a size will not be restocked). The page
 * shows how many products and pieces are in each stage, each product's
 * pieces per size or color, who preordered, the close date (which she can
 * move), and a CSV export of what is still to order. Cancelled and closed
 * preorders are not counted.
 *
 * @phpstan-type VariantCount array{id: int, label: string|null, estore_item_code: string|null, students: int, pieces: int, free_to_sell: int, not_restocked: bool}
 */
class PreorderController extends Controller
{
    public const STAGES = ['all', 'sold_out', 'open', 'to_order', 'arrived'];

    /** Students listed in the details popup; the full list has its own page. */
    public const DETAILS_SHOWN = 100;

    /**
     * Products by stage (all by default: to order and waiting for restock
     * first, then those taking preorders closing soonest, then arrived
     * ones), with a search, the numbers per stage, and one product's details
     * when asked.
     */
    public function index(Request $request): Response
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            'stage' => ['nullable', Rule::in(self::STAGES)],
            'details' => ['nullable', 'integer'],
        ]);
        $search = trim((string) ($validated['search'] ?? ''));
        $stage = $validated['stage'] ?? 'all';
        $today = now()->toDateString();

        $products = $this->withPreorderTotals($this->inStage(Product::query(), $stage))
            ->with('mainPhoto')
            ->when($search !== '', fn (Builder $query) => $query->whereLike('name', "%{$search}%"))
            ->orderByRaw(
                "case when status = 'preorder' and preorders_close_on >= ? then 1 when status in ('available', 'on_sale') and exists (select 1 from preorders where preorders.product_id = products.id and preorders.status = 'active') then 0 when status in ('available', 'on_sale') then 2 when status = 'preorder' and preorders_close_on is null then 1 else 0 end",
                [$today],
            )
            ->orderByRaw('case when preorders_close_on is null then 1 else 0 end')
            ->orderBy('preorders_close_on')
            ->orderBy('name')
            ->paginate(20)
            ->withQueryString();

        $ids = $products->getCollection()->modelKeys();
        $waiting = $this->countsByVariant($ids, PreorderStatus::Active);
        $arrived = $this->countsByVariant($ids, PreorderStatus::Arrived);

        return Inertia::render('preorders/index', [
            'products' => $products->through(fn (Product $product): array => [
                ...$this->productSummary($product, $stage),
                'variants' => ($this->stageOf($product, $stage) === 'arrived' ? $arrived : $waiting)->get($product->id, collect())->values()->all(),
            ]),
            'filters' => ['search' => $search === '' ? null : $search, 'stage' => $stage],
            'summary' => $this->summary(),
            'details' => Inertia::optional(fn (): ?array => isset($validated['details']) ? $this->details((int) $validated['details'], $stage) : null),
            'today' => $today,
        ]);
    }

    /**
     * Who preordered one product (the full list): each student, size or
     * color, how many, and whether it arrived.
     */
    public function show(Product $product): Response
    {
        $product = $this->withPreorderTotals(Product::query()->whereKey($product->id))
            ->with('mainPhoto')
            ->firstOrFail();

        return Inertia::render('preorders/show', [
            'product' => [
                ...$this->productSummary($product),
                'variants' => $this->countsByVariant([$product->id], $this->countedStatus($product))->get($product->id, collect())->values()->all(),
            ],
            'preorders' => $this->preordersOf($product)
                ->paginate(50)
                ->withQueryString()
                ->through(fn (Preorder $preorder): array => $this->preorderRow($preorder)),
            'today' => now()->toDateString(),
        ]);
    }

    /**
     * What to order in the eStore, as a CSV file that opens in Excel: the
     * products whose preorders closed and the sold-out sizes students are
     * waiting for, only the sizes or colors with pieces, and a total per
     * product. With ?product= it is that one product's preorders so far.
     * The eStore Item Code column is left out when no row has one.
     */
    public function export(Request $request): StreamedResponse
    {
        $productId = $request->integer('product') ?: null;
        $products = ($productId !== null
            ? Product::query()->whereKey($productId)
            : Product::query()->where(fn (Builder $either) => $either
                ->where(fn (Builder $closed) => $this->inStage($closed, 'to_order'))
                ->orWhere(fn (Builder $soldOut) => $this->inStage($soldOut, 'sold_out'))))
            ->with(['variants' => fn ($variants) => $variants->orderBy('position')->orderBy('id')])
            ->orderBy('name')
            ->get();
        $counts = $this->countsByVariant($products->modelKeys(), PreorderStatus::Active);
        $studentsByProduct = Preorder::query()
            ->where('status', PreorderStatus::Active)
            ->whereIn('product_id', $products->modelKeys())
            ->groupBy('product_id')
            ->selectRaw('product_id, count(distinct user_id) as students')
            ->pluck('students', 'product_id');

        // Only sizes or colors someone preordered.
        $rows = [];

        foreach ($products as $product) {
            $variantCounts = $counts->get($product->id, collect())->keyBy('id');
            $productRows = [];

            foreach ($product->variants as $variant) {
                $pieces = (int) ($variantCounts->get($variant->id)['pieces'] ?? 0);

                if ($pieces > 0) {
                    $productRows[] = [
                        'product' => $product->name,
                        'variant' => $variant->choices === [] ? '' : $variant->label(),
                        'code' => $variant->estore_item_code ?? '',
                        'close' => $product->status === ProductStatus::Preorder ? ($product->preorders_close_on?->format('M j, Y') ?? '') : 'Out of stock',
                        'students' => (int) ($variantCounts->get($variant->id)['students'] ?? 0),
                        'pieces' => $pieces,
                    ];
                }
            }

            if (count($productRows) > 1) {
                $productRows[] = [
                    'product' => $product->name,
                    'variant' => 'Total',
                    'code' => '',
                    'close' => '',
                    'students' => (int) ($studentsByProduct[$product->id] ?? 0),
                    'pieces' => array_sum(array_column($productRows, 'pieces')),
                ];
            }

            array_push($rows, ...$productRows);
        }

        $withCodes = collect($rows)->contains(fn (array $row): bool => $row['code'] !== '');
        $fileName = ($productId !== null && $products->isNotEmpty()
            ? Str::slug($products->first()->name).'-preorders-'
            : 'what-to-order-').now()->format('Y-m-d').'.csv';

        return response()->streamDownload(function () use ($rows, $withCodes): void {
            $file = fopen('php://output', 'w');

            if ($file === false) {
                return;
            }

            // Lets Excel read the file as UTF-8 (₱, ñ).
            fwrite($file, "\xEF\xBB\xBF");
            fputcsv($file, array_values(array_filter(
                ['Product', 'Size / Color', $withCodes ? 'eStore Item Code' : null, 'Preorders Close', 'No. of Students', 'Pieces to Order'],
                fn (?string $heading): bool => $heading !== null,
            )), escape: '');

            foreach ($rows as $row) {
                if (! $withCodes) {
                    unset($row['code']);
                }

                fputcsv($file, array_values($row), escape: '');
            }

            fclose($file);
        }, $fileName, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * Move the last day students can preorder the product.
     */
    public function updateCloseDate(UpdatePreorderCloseDateRequest $request, Product $product): RedirectResponse
    {
        $closeOn = CarbonImmutable::parse((string) $request->input('preorders_close_on'));
        $product->update(['preorders_close_on' => $closeOn->toDateString()]);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => "Preorders for {$product->name} will now close on {$closeOn->format('M j, Y')}.",
        ]);

        return back();
    }

    /**
     * Keeps the products in a stage:
     * - open: Preorder products still taking preorders;
     * - to_order: Preorder products whose preorders closed (and products
     *   taken off preorder that still have waiting preorders);
     * - sold_out: products for sale with preorders waiting for a sold-out
     *   size, or a size marked as not restocked;
     * - arrived: products for sale whose preorders arrived.
     *
     * @param  Builder<Product>  $query
     * @return Builder<Product>
     */
    private function inStage(Builder $query, string $stage): Builder
    {
        $soldOut = fn (Builder $products) => $products
            ->whereIn('status', [ProductStatus::Available, ProductStatus::OnSale])
            ->where(fn (Builder $either) => $either
                ->whereHas('preorders', fn (Builder $preorders) => $preorders->where('status', PreorderStatus::Active))
                ->orWhereHas('variants', fn (Builder $variants) => $variants->whereNotNull('not_restocked_at')));
        $today = now()->toDateString();
        $open = fn (Builder $products) => $products
            ->where('status', ProductStatus::Preorder)
            ->where(fn (Builder $date) => $date->whereNull('preorders_close_on')->orWhereDate('preorders_close_on', '>=', $today));
        $toOrder = fn (Builder $products) => $products
            ->where(fn (Builder $either) => $either
                ->where(fn (Builder $closed) => $closed->where('status', ProductStatus::Preorder)->whereDate('preorders_close_on', '<', $today))
                ->orWhere(fn (Builder $other) => $other
                    ->whereNotIn('status', [ProductStatus::Preorder, ProductStatus::Available, ProductStatus::OnSale])
                    ->whereHas('preorders', fn (Builder $preorders) => $preorders->where('status', PreorderStatus::Active))));
        $arrived = fn (Builder $products) => $products
            ->whereIn('status', [ProductStatus::Available, ProductStatus::OnSale])
            ->whereHas('preorders', fn (Builder $preorders) => $preorders->whereIn('status', PreorderStatus::arrivedGroup()));

        return match ($stage) {
            'open' => $query->where($open),
            'to_order' => $query->where($toOrder),
            'sold_out' => $query->where($soldOut),
            'arrived' => $query->where($arrived),
            default => $query->where(fn (Builder $any) => $any->where($open)->orWhere($toOrder)->orWhere($soldOut)->orWhere($arrived)),
        };
    }

    /**
     * The product's stage. A product for sale can be both waiting for a
     * restock and arrived: the tab shown decides; on All it is waiting for
     * restock while students wait or a size is marked as not restocked.
     * Needs withPreorderTotals.
     */
    private function stageOf(Product $product, string $tab = 'all'): string
    {
        if ($product->status === ProductStatus::Preorder) {
            return $product->acceptsPreorders() ? 'open' : 'to_order';
        }

        if (! in_array($product->status, [ProductStatus::Available, ProductStatus::OnSale], true)) {
            return 'to_order';
        }

        if (in_array($tab, ['sold_out', 'arrived'], true)) {
            return $tab;
        }

        return (int) $product->getAttribute('students_count') > 0 || (int) $product->getAttribute('not_restocked_variants') > 0
            ? 'sold_out'
            : 'arrived';
    }

    /**
     * Arrived products count the preorders that arrived; the others count
     * those still waiting.
     */
    private function countedStatus(Product $product, string $tab = 'all'): PreorderStatus
    {
        return $this->stageOf($product, $tab) === 'arrived' ? PreorderStatus::Arrived : PreorderStatus::Active;
    }

    /**
     * How many products, students and pieces are in each stage.
     *
     * @return array<string, array{products: int, students: int, pieces: int}>
     */
    private function summary(): array
    {
        $numbers = function (string $stage, PreorderStatus $status): array {
            $productIds = $this->inStage(Product::query(), $stage)->select('id');
            $preorders = Preorder::query()->countedAs($status)->whereIn('product_id', $productIds);

            return [
                'products' => $this->inStage(Product::query(), $stage)->count(),
                'students' => (clone $preorders)->distinct()->count('user_id'),
                'pieces' => (int) (clone $preorders)->sum('quantity'),
            ];
        };

        return [
            'sold_out' => $numbers('sold_out', PreorderStatus::Active),
            'open' => $numbers('open', PreorderStatus::Active),
            'to_order' => $numbers('to_order', PreorderStatus::Active),
            'arrived' => $numbers('arrived', PreorderStatus::Arrived),
        ];
    }

    /**
     * One product for the details popup: pieces per size or color (what to
     * order) and the students who preordered, the newest first.
     *
     * @return array<string, mixed>|null
     */
    private function details(int $productId, string $tab = 'all'): ?array
    {
        $product = $this->withPreorderTotals(Product::query()->whereKey($productId))->with('mainPhoto')->first();

        if ($product === null) {
            return null;
        }

        $preorders = $this->preordersOf($product, $tab);

        return [
            ...$this->productSummary($product, $tab),
            'variants' => $this->countsByVariant([$product->id], $this->countedStatus($product, $tab))->get($product->id, collect())->values()->all(),
            'preorders' => array_values($preorders->clone()->limit(self::DETAILS_SHOWN)->get()->map(fn (Preorder $preorder): array => $this->preorderRow($preorder))->all()),
            'preorders_count' => $preorders->count(),
        ];
    }

    /**
     * The product's preorders that count (waiting, or arrived once it is
     * for sale), the newest first.
     *
     * @return HasMany<Preorder, Product>
     */
    private function preordersOf(Product $product, string $tab = 'all'): HasMany
    {
        return $product->preorders()
            ->countedAs($this->countedStatus($product, $tab))
            ->with(['student', 'variant'])
            ->latest('id');
    }

    /**
     * @return array{id: int, student_name: string, student_email: string, variant_label: string|null, quantity: int, status: string, status_label: string, created_at: string|null, arrived_at: string|null}
     */
    private function preorderRow(Preorder $preorder): array
    {
        return [
            'id' => $preorder->id,
            'student_name' => $preorder->student->name,
            'student_email' => $preorder->student->email,
            'variant_label' => $preorder->variant->choices === [] ? null : $preorder->variant->label(),
            'quantity' => $preorder->quantity,
            'status' => $preorder->status->value,
            'status_label' => $preorder->status->staffLabel(),
            'created_at' => $preorder->created_at?->toIso8601String(),
            'arrived_at' => $preorder->arrived_at?->toIso8601String(),
        ];
    }

    /**
     * Adds how many students preordered and how many pieces, still waiting
     * and arrived, and when the students were told it arrived.
     *
     * @param  Builder<Product>  $query
     * @return Builder<Product>
     */
    private function withPreorderTotals(Builder $query): Builder
    {
        $ofProduct = fn (PreorderStatus $status) => Preorder::query()
            ->whereColumn('preorders.product_id', 'products.id')
            ->countedAs($status);

        return $query->addSelect([
            'students_count' => $ofProduct(PreorderStatus::Active)->selectRaw('count(distinct user_id)'),
            'pieces_total' => $ofProduct(PreorderStatus::Active)->selectRaw('coalesce(sum(quantity), 0)'),
            'arrived_students' => $ofProduct(PreorderStatus::Arrived)->selectRaw('count(distinct user_id)'),
            'arrived_pieces' => $ofProduct(PreorderStatus::Arrived)->selectRaw('coalesce(sum(quantity), 0)'),
            'arrived_at' => $ofProduct(PreorderStatus::Arrived)->selectRaw('max(arrived_at)'),
            'not_restocked_variants' => ProductVariant::query()
                ->whereColumn('product_variants.product_id', 'products.id')
                ->whereNotNull('not_restocked_at')
                ->selectRaw('count(*)'),
        ]);
    }

    /**
     * @return array{id: int, name: string, photo_url: string|null, status: string, status_label: string, stage: string, preorders_close_on: string|null, accepts_preorders: bool, students_count: int, pieces_total: int, arrived_at: string|null}
     */
    private function productSummary(Product $product, string $tab = 'all'): array
    {
        $stage = $this->stageOf($product, $tab);
        $arrivedAt = $product->getAttribute('arrived_at');

        return [
            'id' => $product->id,
            'name' => $product->name,
            'photo_url' => $product->mainPhoto?->url(),
            'status' => $product->status->value,
            'status_label' => $product->status->label(),
            'stage' => $stage,
            'preorders_close_on' => $product->preorders_close_on?->toDateString(),
            'accepts_preorders' => $product->acceptsPreorders(),
            'students_count' => (int) $product->getAttribute($stage === 'arrived' ? 'arrived_students' : 'students_count'),
            'pieces_total' => (int) $product->getAttribute($stage === 'arrived' ? 'arrived_pieces' : 'pieces_total'),
            'arrived_at' => is_string($arrivedAt) ? CarbonImmutable::parse($arrivedAt)->toIso8601String() : null,
        ];
    }

    /**
     * Students and pieces per size or color, for these products, counting
     * preorders with this status.
     *
     * @param  array<int, int>  $productIds
     * @return Collection<int|string, Collection<int|string, VariantCount>> by product id
     */
    private function countsByVariant(array $productIds, PreorderStatus $status): Collection
    {
        $counts = Preorder::query()
            ->countedAs($status)
            ->whereIn('product_id', $productIds)
            ->groupBy('product_variant_id')
            ->selectRaw('product_variant_id, count(distinct user_id) as students, sum(quantity) as pieces')
            ->get()
            ->keyBy('product_variant_id');

        return ProductVariant::query()
            ->whereIn('product_id', $productIds)
            ->orderBy('position')
            ->get()
            ->groupBy('product_id')
            ->map(fn (Collection $variants): Collection => $variants->map(fn (ProductVariant $variant): array => [
                'id' => $variant->id,
                'label' => $variant->choices === [] ? null : $variant->label(),
                'estore_item_code' => $variant->estore_item_code,
                'students' => (int) ($counts->get($variant->id)?->getAttribute('students') ?? 0),
                'pieces' => (int) ($counts->get($variant->id)?->getAttribute('pieces') ?? 0),
                'free_to_sell' => $variant->freeToSell(),
                'not_restocked' => $variant->not_restocked_at !== null,
            ]));
    }
}
