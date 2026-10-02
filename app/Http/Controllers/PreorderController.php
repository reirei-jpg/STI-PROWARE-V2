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
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The Specialist's Preorders page: how many students preordered each
 * Preorder product, per size or color, so she knows how many to order in
 * the eStore; who preordered; the close date (which she can move); and a
 * CSV export to open in Excel. Cancelled preorders are not counted.
 */
class PreorderController extends Controller
{
    /**
     * Preorder products and products that still have preorders, the ones
     * closing soonest first.
     */
    public function index(Request $request): Response
    {
        $validated = $request->validate(['search' => ['nullable', 'string', 'max:120']]);
        $search = trim((string) ($validated['search'] ?? ''));

        $products = $this->productsWithPreorders()
            ->with('mainPhoto')
            ->when($search !== '', fn (Builder $query) => $query->whereLike('name', "%{$search}%"))
            ->orderByRaw('case when preorders_close_on is null then 1 else 0 end')
            ->orderBy('preorders_close_on')
            ->orderBy('name')
            ->paginate(20)
            ->withQueryString();

        $byVariant = $this->countsByVariant($products->getCollection()->modelKeys());

        return Inertia::render('preorders/index', [
            'products' => $products->through(fn (Product $product): array => [
                ...$this->productSummary($product),
                'variants' => $byVariant->get($product->id, collect())->values()->all(),
            ]),
            'filters' => ['search' => $search === '' ? null : $search],
            'totals' => [
                'students' => Preorder::query()->where('status', PreorderStatus::Active)->distinct()->count('user_id'),
                'pieces' => (int) Preorder::query()->where('status', PreorderStatus::Active)->sum('quantity'),
            ],
            'today' => now()->toDateString(),
        ]);
    }

    /**
     * Who preordered one product: each student, size or color, how many.
     */
    public function show(Product $product): Response
    {
        $product = $this->withPreorderTotals(Product::query()->whereKey($product->id))
            ->with('mainPhoto')
            ->firstOrFail();

        $preorders = $product->preorders()
            ->where('status', PreorderStatus::Active)
            ->with(['student', 'variant'])
            ->latest('id')
            ->paginate(50)
            ->withQueryString()
            ->through(fn (Preorder $preorder): array => [
                'id' => $preorder->id,
                'student_name' => $preorder->student->name,
                'student_email' => $preorder->student->email,
                'variant_label' => $preorder->variant->choices === [] ? null : $preorder->variant->label(),
                'quantity' => $preorder->quantity,
                'created_at' => $preorder->created_at?->toIso8601String(),
            ]);

        return Inertia::render('preorders/show', [
            'product' => [
                ...$this->productSummary($product),
                'variants' => $this->countsByVariant([$product->id])->get($product->id, collect())->values()->all(),
            ],
            'preorders' => $preorders,
            'today' => now()->toDateString(),
        ]);
    }

    /**
     * The summary per size or color as a CSV file that opens in Excel.
     */
    public function export(): StreamedResponse
    {
        $products = $this->productsWithPreorders()->with('variants')->orderBy('name')->get();
        $counts = $this->countsByVariant($products->modelKeys());

        return response()->streamDownload(function () use ($products, $counts): void {
            $file = fopen('php://output', 'w');

            if ($file === false) {
                return;
            }

            // Lets Excel read the file as UTF-8 (₱, ñ).
            fwrite($file, "\xEF\xBB\xBF");
            fputcsv($file, ['Product', 'Size / Color', 'eStore Item Code', 'Preorders Close', 'No. of Students', 'Total Pieces'], escape: '');

            foreach ($products as $product) {
                $variantCounts = $counts->get($product->id, collect())->keyBy('id');

                foreach ($product->variants as $variant) {
                    $row = $variantCounts->get($variant->id);

                    fputcsv($file, [
                        $product->name,
                        $variant->choices === [] ? '' : $variant->label(),
                        $variant->estore_item_code ?? '',
                        $product->preorders_close_on?->format('M j, Y') ?? '',
                        $row['students'] ?? 0,
                        $row['pieces'] ?? 0,
                    ], escape: '');
                }
            }

            fclose($file);
        }, 'preorders-'.now()->format('Y-m-d').'.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
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
            'message' => "Preorders for {$product->name} now close on {$closeOn->format('M j, Y')}.",
        ]);

        return back();
    }

    /**
     * Preorder products, and other products that still have preorders, with
     * how many students preordered and how many pieces.
     *
     * @return Builder<Product>
     */
    private function productsWithPreorders(): Builder
    {
        return $this->withPreorderTotals(Product::query()
            ->where(fn (Builder $query) => $query
                ->where('status', ProductStatus::Preorder)
                ->orWhereHas('preorders', fn (Builder $preorders) => $preorders->where('status', PreorderStatus::Active))));
    }

    /**
     * Adds how many students preordered and how many pieces in total.
     *
     * @param  Builder<Product>  $query
     * @return Builder<Product>
     */
    private function withPreorderTotals(Builder $query): Builder
    {
        return $query
            ->addSelect([
                'students_count' => Preorder::query()
                    ->selectRaw('count(distinct user_id)')
                    ->whereColumn('preorders.product_id', 'products.id')
                    ->where('status', PreorderStatus::Active),
                'pieces_total' => Preorder::query()
                    ->selectRaw('coalesce(sum(quantity), 0)')
                    ->whereColumn('preorders.product_id', 'products.id')
                    ->where('status', PreorderStatus::Active),
            ]);
    }

    /**
     * @return array{id: int, name: string, photo_url: string|null, status: string, status_label: string, preorders_close_on: string|null, accepts_preorders: bool, students_count: int, pieces_total: int}
     */
    private function productSummary(Product $product): array
    {
        return [
            'id' => $product->id,
            'name' => $product->name,
            'photo_url' => $product->mainPhoto?->url(),
            'status' => $product->status->value,
            'status_label' => $product->status->label(),
            'preorders_close_on' => $product->preorders_close_on?->toDateString(),
            'accepts_preorders' => $product->acceptsPreorders(),
            'students_count' => (int) $product->getAttribute('students_count'),
            'pieces_total' => (int) $product->getAttribute('pieces_total'),
        ];
    }

    /**
     * Students and pieces per size or color, for these products.
     *
     * @param  array<int, int>  $productIds
     * @return Collection<int|string, Collection<int|string, array{id: int, label: string|null, estore_item_code: string|null, students: int, pieces: int}>> by product id
     */
    private function countsByVariant(array $productIds): Collection
    {
        $counts = Preorder::query()
            ->where('status', PreorderStatus::Active)
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
            ]));
    }
}
