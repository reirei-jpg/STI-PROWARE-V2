<?php

namespace App\Http\Controllers;

use App\Actions\Products\SaveProduct;
use App\Enums\OrderStatus;
use App\Enums\ProductStatus;
use App\Enums\StockMovementType;
use App\Http\Requests\FilterProductsRequest;
use App\Http\Requests\SaveProductRequest;
use App\Models\Product;
use App\Models\ProductOption;
use App\Models\ProductPack;
use App\Models\ProductPhoto;
use App\Models\ProductVariant;
use App\Models\PurchaseOrderItem;
use App\Models\StockMovement;
use App\Services\EstorePo\ItemCode;
use App\Services\Sales\HeadOfficeCost;
use App\Services\Stock\LinkedItems;
use App\Services\Stock\LowStockAlerts;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The Specialist's products: what students see and buy on the storefront.
 */
class ProductController extends Controller
{
    /**
     * List the products, most recently changed first, with a name search, a
     * status filter and the "Low stock" and "Slow-moving" filters.
     */
    public function index(FilterProductsRequest $request): Response
    {
        $search = $request->search();
        $status = $request->status();
        $stockFilter = $request->stockFilter();
        $slowDays = $request->slowMovingDays();

        $movementsOfThisProduct = fn () => StockMovement::query()
            ->join('product_variants', 'product_variants.id', '=', 'stock_movements.product_variant_id')
            ->whereColumn('product_variants.product_id', 'products.id');

        $products = Product::query()
            ->with(['mainPhoto', 'packs'])
            ->withCount('variants')
            ->withSum('variants', 'stock_on_hand')
            ->withMin('variants as lowest_variant_sale_price', 'sale_price_centavos')
            ->withExists(['variants as has_variant_at_alert' => fn (Builder $variants) => $variants->whereRaw(ProductVariant::FREE_TO_SELL_SQL.' <= products.low_stock_alert_at')])
            ->addSelect([
                'first_received_at' => $movementsOfThisProduct()->selectRaw('min(stock_movements.created_at)'),
                'last_sale_at' => $movementsOfThisProduct()
                    ->selectRaw('max(stock_movements.created_at)')
                    ->where('stock_movements.type', StockMovementType::Sale)
                    ->whereHas('orderItem.order', fn (Builder $orders) => $orders->where('status', '!=', OrderStatus::Cancelled)),
            ])
            ->withCasts(['first_received_at' => 'datetime', 'last_sale_at' => 'datetime'])
            ->when($search, fn (Builder $query, string $name) => $query->whereLike('name', "%{$name}%"))
            ->when($status, fn (Builder $query, ProductStatus $chosen) => $query->where('status', $chosen))
            ->when($stockFilter === 'low', fn (Builder $query) => $query->lowOnStock())
            ->when($stockFilter === 'slow', fn (Builder $query) => $query->slowMoving($slowDays))
            ->latest('updated_at')
            ->latest('id')
            ->paginate(20)
            ->withQueryString()
            ->through(fn (Product $product): array => [
                'id' => $product->id,
                'name' => $product->name,
                'status' => $product->status->value,
                'status_label' => $product->status->label(),
                'sold_by_piece' => $product->sold_by_piece,
                'price_centavos' => $product->price_centavos,
                // One sale price for every variant, or the lowest of their own.
                'sale_price_centavos' => $product->status === ProductStatus::OnSale
                    ? ($product->sale_price_centavos ?? $product->getAttribute('lowest_variant_sale_price'))
                    : null,
                'sale_by_variant' => $product->status === ProductStatus::OnSale
                    && $product->sale_price_centavos === null
                    && $product->getAttribute('lowest_variant_sale_price') !== null,
                'packs_for_sale' => $product->packs
                    ->where('sold_to_students', true)
                    ->map(fn (ProductPack $pack): array => [
                        'name' => $pack->name,
                        'pieces' => $pack->pieces,
                        'price_centavos' => (int) $pack->price_centavos,
                        'sale_price_centavos' => $product->status === ProductStatus::OnSale ? $pack->sale_price_centavos : null,
                    ])
                    ->values()
                    ->all(),
                'stock_on_hand' => (int) $product->getAttribute('variants_sum_stock_on_hand'),
                'low_stock_alert_at' => $product->low_stock_alert_at,
                'low_stock' => LowStockAlerts::isSold($product) && (bool) $product->getAttribute('has_variant_at_alert'),
                'sale_ends_at' => $product->status === ProductStatus::OnSale ? $product->sale_ends_at?->toIso8601String() : null,
                'first_received_at' => $product->getAttribute('first_received_at')?->toIso8601String(),
                'last_sale_at' => $product->getAttribute('last_sale_at')?->toIso8601String(),
                'photo_url' => $product->mainPhoto?->url(),
                'variants_count' => $product->variants_count,
                'updated_at' => $product->updated_at?->toIso8601String(),
            ]);

        return Inertia::render('products/index', [
            'products' => $products,
            'filters' => [
                'search' => $search,
                'status' => $status?->value,
                'stock' => $stockFilter,
                'slow_days' => $slowDays,
            ],
            'lowStockCount' => Product::query()->lowOnStock()->count(),
            'slowMovingCount' => Product::query()->slowMoving($slowDays)->count(),
            'itemsToLinkCount' => PurchaseOrderItem::query()
                ->notLinkedToProduct()
                ->distinct()
                ->count('item_code'),
            'itemsToSplitCount' => LinkedItems::waitingToSplit()->count(),
            'details' => Inertia::optional(fn (): ?array => $request->filled('details') ? $this->details($request->integer('details')) : null),
        ]);
    }

    /**
     * One product for its View Details popup: its status, sale end, the
     * low-stock number, and each size or color with its stock, what is held
     * for open orders, what is free to sell, and its price.
     *
     * @return array<string, mixed>|null
     */
    private function details(int $productId): ?array
    {
        $product = Product::query()
            ->with(['variants' => fn ($variants) => $variants->orderBy('position')->orderBy('id')])
            ->find($productId);

        if ($product === null) {
            return null;
        }

        $onSale = $product->status === ProductStatus::OnSale;

        return [
            'id' => $product->id,
            'name' => $product->name,
            'status' => $product->status->value,
            'status_label' => $product->status->label(),
            'sale_ends_at' => $onSale ? $product->sale_ends_at?->toIso8601String() : null,
            'low_stock_alert_at' => $product->low_stock_alert_at,
            'watched_for_low_stock' => LowStockAlerts::isSold($product),
            'updated_at' => $product->updated_at?->toIso8601String(),
            'variants' => $product->variants->map(fn (ProductVariant $variant): array => [
                'id' => $variant->id,
                'label' => $variant->choices === [] ? null : $variant->label(),
                'stock_on_hand' => $variant->stock_on_hand,
                'held_pieces' => $variant->held_pieces,
                'free_to_sell' => $variant->freeToSell(),
                'price_centavos' => $variant->price_centavos ?? $product->price_centavos,
                'sale_price_centavos' => $onSale ? ($variant->sale_price_centavos ?? $product->sale_price_centavos) : null,
            ])->values()->all(),
        ];
    }

    /**
     * The Add Product form. From Items to Link, "Create product" opens it
     * with the eStore item's description as the name and its code on the
     * product's variant.
     */
    public function create(Request $request): Response
    {
        $itemCode = ItemCode::normalize($request->string('item_code')->value());
        $orderedItem = $itemCode === null || ProductVariant::query()->where('estore_item_code', $itemCode)->exists()
            ? null
            : PurchaseOrderItem::query()->where('item_code', $itemCode)->latest('id')->first();

        return Inertia::render('products/form', [
            'product' => null,
            'fromItem' => $orderedItem === null ? null : [
                'item_code' => $orderedItem->item_code,
                'description' => $orderedItem->description,
            ],
            // What PROWARE paid per eStore unit, shown beside the Selling Price.
            'costs' => $orderedItem === null ? [] : HeadOfficeCost::latestUnitPrices([$orderedItem->item_code]),
            'today' => now()->toDateString(),
        ]);
    }

    public function store(SaveProductRequest $request, SaveProduct $saveProduct): RedirectResponse
    {
        $product = new Product;
        $this->flashSaved($product, $saveProduct->handle($product, $request));

        return to_route('products.index');
    }

    public function edit(Product $product): Response
    {
        $product->load(['photos', 'options', 'variants', 'packs']);

        return Inertia::render('products/form', [
            'product' => [
                'id' => $product->id,
                'name' => $product->name,
                'sold_by_piece' => $product->sold_by_piece,
                'price' => $product->price_centavos === null ? '' : $this->pesos($product->price_centavos),
                'status' => $product->status->value,
                'sale_ends_at' => $product->status === ProductStatus::OnSale ? $product->sale_ends_at?->toIso8601String() : null,
                'preorders_close_on' => $product->preorders_close_on?->toDateString() ?? '',
                'low_stock_alert_at' => (string) $product->low_stock_alert_at,
                'photos' => $product->photos->map(fn (ProductPhoto $photo): array => [
                    'id' => $photo->id,
                    'url' => $photo->url(),
                    'label' => $photo->label ?? '',
                ])->all(),
                'packs' => $product->packs->map(fn (ProductPack $pack): array => [
                    'key' => (string) $pack->id,
                    'id' => $pack->id,
                    'name' => $pack->name,
                    'pieces' => (string) $pack->pieces,
                    'sold_to_students' => $pack->sold_to_students,
                    'price' => $pack->price_centavos === null ? '' : $this->pesos($pack->price_centavos),
                ])->all(),
                'options' => $product->options->map(fn (ProductOption $option): array => [
                    'name' => $option->name,
                    'choices' => $option->choices,
                ])->all(),
                'variants' => $product->variants->map(fn (ProductVariant $variant): array => [
                    'combination' => $variant->combination,
                    'estore_item_code' => $variant->estore_item_code ?? '',
                    'estore_pack_key' => $variant->estore_pack_id === null ? '' : (string) $variant->estore_pack_id,
                    'price' => $variant->price_centavos === null ? '' : $this->pesos($variant->price_centavos),
                    'stock_on_hand' => $variant->stock_on_hand,
                ])->all(),
            ],
            'fromItem' => null,
            // What PROWARE paid per eStore unit, shown beside the Selling Price.
            'costs' => HeadOfficeCost::latestUnitPrices(array_values(array_unique(array_filter($product->variants->pluck('estore_item_code')->all(), 'is_string')))),
            'today' => now()->toDateString(),
        ]);
    }

    public function update(SaveProductRequest $request, Product $product, SaveProduct $saveProduct): RedirectResponse
    {
        $this->flashSaved($product, $saveProduct->handle($product, $request));

        return to_route('products.index');
    }

    /**
     * What was saved and whether students see it, e.g. "STI Aqua Flask has
     * been saved with 3 variants. It is now visible to students.", and how
     * many pieces of earlier deliveries went into stock when an eStore Item
     * Code was linked.
     */
    private function flashSaved(Product $product, int $piecesAdded): void
    {
        $variants = $product->variants()->count();

        $message = "{$product->name} has been saved"
            .($product->status === ProductStatus::Draft ? ' as a draft' : '')
            .($variants > 1 ? " with {$variants} variants" : '').'. '
            .match ($product->status) {
                ProductStatus::Draft => 'It is not visible to students.',
                ProductStatus::Preorder => 'It is open for preorders until '.$product->preorders_close_on?->format('M j, Y').'.',
                ProductStatus::Available => 'It is now visible to students.',
                ProductStatus::OnSale => 'It is currently on sale.',
            };

        if ($piecesAdded > 0) {
            $message .= ' '.number_format($piecesAdded).($piecesAdded === 1 ? ' piece' : ' pieces').' from earlier deliveries '.($piecesAdded === 1 ? 'has' : 'have').' been added to stock.';
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => $message]);
    }

    /**
     * 35050 becomes "350.50"; whole pesos stay whole ("350").
     */
    private function pesos(int $centavos): string
    {
        return $centavos % 100 === 0
            ? (string) intdiv($centavos, 100)
            : number_format($centavos / 100, 2, '.', '');
    }
}
