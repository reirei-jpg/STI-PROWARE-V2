<?php

namespace App\Http\Controllers;

use App\Actions\Products\SaveProduct;
use App\Enums\OrderStatus;
use App\Enums\ProductCategory;
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
use App\Services\Preorders\BackOrders;
use App\Services\Sales\HeadOfficeCost;
use App\Services\Sales\SellingBelowCost;
use App\Services\Stock\LowStockAlerts;
use App\Services\Stock\ReorderPoints;
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
        [$slowFrom, $slowTo] = $request->slowPeriod();
        [$fewestSold, $mostSold] = $request->soldRange();

        $belowCost = collect(SellingBelowCost::products())->keyBy('product_id');

        $movementsOfThisProduct = fn () => StockMovement::query()
            ->join('product_variants', 'product_variants.id', '=', 'stock_movements.product_variant_id')
            ->whereColumn('product_variants.product_id', 'products.id');

        $products = Product::query()
            ->with(['mainPhoto', 'packs'])
            ->withCount([
                'variants',
                // Available with no pieces left reads as Out of stock.
                'variants as available_variants_count' => fn (Builder $variants) => $variants->where('status', ProductStatus::Available)->where('stock_on_hand', '>', 0),
                'variants as out_of_stock_variants_count' => fn (Builder $variants) => $variants->where('status', ProductStatus::Available)->where('stock_on_hand', 0),
                'variants as preorder_variants_count' => fn (Builder $variants) => $variants->where('status', ProductStatus::Preorder),
                'variants as draft_variants_count' => fn (Builder $variants) => $variants->where('status', ProductStatus::Draft),
            ])
            ->withSum('variants', 'stock_on_hand')
            ->withSum(['variants as draft_stock_on_hand' => fn (Builder $variants) => $variants->where('status', ProductStatus::Draft)], 'stock_on_hand')
            ->withMin('variants as lowest_variant_sale_price', 'sale_price_centavos')
            ->withExists(['variants as has_variant_at_alert' => fn (Builder $variants) => $variants->atReorderPoint()])
            ->addSelect([
                'first_received_at' => $movementsOfThisProduct()->selectRaw('min(stock_movements.created_at)'),
                'last_sale_at' => $movementsOfThisProduct()
                    ->selectRaw('max(stock_movements.created_at)')
                    ->where('stock_movements.type', StockMovementType::Sale)
                    ->whereHas('orderItem.order', fn (Builder $orders) => $orders->where('status', '!=', OrderStatus::Cancelled)),
            ])
            ->withCasts(['first_received_at' => 'datetime', 'last_sale_at' => 'datetime'])
            ->when($search, fn (Builder $query, string $name) => $query->whereLike('name', "%{$name}%"))
            // Draft also lists products with some sizes or colors kept as a Draft.
            ->when($status, fn (Builder $query, ProductStatus $chosen) => $query->where(fn (Builder $matching) => $matching
                ->where('status', $chosen)
                ->when($chosen === ProductStatus::Draft, fn (Builder $withDrafts) => $withDrafts
                    ->orWhereHas('variants', fn (Builder $variants) => $variants->where('status', ProductStatus::Draft)))))
            ->when($stockFilter === 'low', fn (Builder $query) => $query->lowButNotOut())
            ->when($stockFilter === 'out', fn (Builder $query) => $query->soldOut())
            // The Low stock and Out of stock lists show only those sizes or colors.
            ->when($stockFilter === 'low', fn (Builder $query) => $query->with(['variants' => fn ($variants) => $variants->lowOnShelf()->orderBy('position')]))
            ->when($stockFilter === 'out', fn (Builder $query) => $query->with(['variants' => fn ($variants) => $variants->nothingLeft()->orderBy('position')]))
            // Slow-moving: the fewest pieces sold in the time first, then the
            // longest since its last sale up to the end of the time (never
            // sold: since it arrived).
            ->when($stockFilter === 'slow', fn (Builder $query) => $query
                ->slowSelling($slowFrom, $slowTo, $fewestSold, $mostSold)
                ->addSelect([
                    'sold_in_period' => Product::piecesSoldBetween($slowFrom, $slowTo),
                    'quiet_since' => $movementsOfThisProduct()
                        ->leftJoin('order_items', 'order_items.id', '=', 'stock_movements.order_item_id')
                        ->leftJoin('orders', 'orders.id', '=', 'order_items.order_id')
                        ->where('stock_movements.created_at', '<=', $slowTo)
                        ->selectRaw('coalesce(max(case when stock_movements.type = ? and orders.status <> ? then stock_movements.created_at end), min(stock_movements.created_at))', [StockMovementType::Sale->value, OrderStatus::Cancelled->value]),
                ])
                ->withCasts(['quiet_since' => 'datetime'])
                ->orderBy('sold_in_period')
                ->orderBy('quiet_since'))
            ->latest('updated_at')
            ->latest('id')
            ->paginate(20)
            ->withQueryString();

        // What is still coming on eStore orders for the sizes in the Reorder and Out of stock lists.
        $onOrder = in_array($stockFilter, ['low', 'out'], true)
            ? ReorderPoints::onOrder($products->getCollection()->flatMap(fn (Product $product) => $product->variants))
            : [];
        $backOrdered = in_array($stockFilter, ['low', 'out'], true)
            ? BackOrders::pendingPieces($products->getCollection()->flatMap(fn (Product $product) => $product->variants))
            : [];

        $products = $products
            ->through(fn (Product $product): array => [
                'id' => $product->id,
                'name' => $product->name,
                'category_label' => $product->category?->label(),
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
                // The pieces of its Draft sizes or colors, shown in the Draft list.
                'draft_stock_on_hand' => (int) $product->getAttribute('draft_stock_on_hand'),
                'low_stock_alert_at' => $product->low_stock_alert_at,
                'low_stock' => LowStockAlerts::isSold($product) && (bool) $product->getAttribute('has_variant_at_alert'),
                // Sold for less than one piece cost on the latest eStore order.
                'below_cost' => $belowCost->get($product->id),
                'sale_ends_at' => $product->status === ProductStatus::OnSale ? $product->sale_ends_at?->toIso8601String() : null,
                'first_received_at' => $product->getAttribute('first_received_at')?->toIso8601String(),
                // Days since its last sale, or since it arrived when never sold.
                'days_without_sale' => $stockFilter === 'slow'
                    ? $product->getAttribute('quiet_since')?->startOfDay()->diffInDays($slowTo->startOfDay())
                    : null,
                // Slow-moving: the pieces sold in the time chosen.
                'sold_in_period' => $stockFilter === 'slow' ? (int) $product->getAttribute('sold_in_period') : null,
                'last_sale_at' => $product->getAttribute('last_sale_at')?->toIso8601String(),
                'photo_url' => $product->mainPhoto?->url(),
                'variants_count' => $product->variants_count,
                // In the Reorder or Out of stock list: those sizes or colors, with
                // what is left, their Reorder Point and how many to order.
                'stock_sizes' => in_array($stockFilter, ['low', 'out'], true)
                    ? $product->variants->map(fn (ProductVariant $variant): array => [
                        'label' => $variant->choices === [] ? null : $variant->label(),
                        'free_to_sell' => $variant->freeToSell(),
                        'reorder' => ReorderPoints::view($variant->setRelation('product', $product), $onOrder[$variant->id] ?? 0, $backOrdered[$variant->id] ?? 0),
                    ])->values()->all()
                    : null,
                // How many sizes or colors have each status, e.g. 12 Available and 6 Draft.
                'variant_statuses' => [
                    'available' => (int) $product->getAttribute('available_variants_count'),
                    'out_of_stock' => (int) $product->getAttribute('out_of_stock_variants_count'),
                    'preorder' => (int) $product->getAttribute('preorder_variants_count'),
                    'draft' => (int) $product->getAttribute('draft_variants_count'),
                ],
                'updated_at' => $product->updated_at?->toIso8601String(),
            ]);

        return Inertia::render('products/index', [
            'products' => $products,
            'filters' => [
                'search' => $search,
                'status' => $status?->value,
                'stock' => $stockFilter,
                'slow_days' => $slowDays,
                'slow' => $request->slowChoice(),
                'slow_from' => $request->slowChoice() === 'range' ? $slowFrom->toDateString() : null,
                'slow_to' => $request->slowChoice() === 'range' ? $slowTo->toDateString() : null,
                'sold' => $request->soldChoice(),
            ],
            'lowStockCount' => Product::query()->lowButNotOut()->count(),
            'outOfStockCount' => Product::query()->soldOut()->count(),
            'slowMovingCount' => Product::query()->slowSelling($slowFrom, $slowTo, 0, FilterProductsRequest::SLOW_MOST_SOLD)->count(),
            'itemsToLinkCount' => PurchaseOrderItem::query()
                ->notLinkedToProduct()
                ->distinct()
                ->count('item_code'),
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
        $onOrder = ReorderPoints::onOrder($product->variants);
        $backOrdered = BackOrders::pendingPieces($product->variants);

        return [
            'id' => $product->id,
            'name' => $product->name,
            'category_label' => $product->category?->label(),
            'status' => $product->status->value,
            'status_label' => $product->status->label(),
            'sale_ends_at' => $onSale ? $product->sale_ends_at?->toIso8601String() : null,
            // The safety stock (part of each Reorder Point).
            'low_stock_alert_at' => $product->low_stock_alert_at,
            'lead_days' => ReorderPoints::leadDays(),
            'most_per_buyer' => $product->most_per_buyer,
            'watched_for_low_stock' => LowStockAlerts::isSold($product),
            'updated_at' => $product->updated_at?->toIso8601String(),
            'variants' => $product->variants->map(fn (ProductVariant $variant): array => [
                'id' => $variant->id,
                'label' => $variant->choices === [] ? null : $variant->label(),
                'item_code' => $variant->estore_item_code,
                'status' => $variant->status->value,
                'status_label' => $variant->status->label(),
                // Hidden from buyers, so never out of stock or low.
                'is_draft' => $variant->isDraft(),
                'stock_on_hand' => $variant->stock_on_hand,
                // Orders do not hold stock: only paid preorders do (arrived, and
                // the order made when one is released).
                'held_pieces' => $variant->held_pieces + $variant->preorder_held_pieces,
                'free_to_sell' => $variant->freeToSell(),
                'reorder' => ReorderPoints::view($variant->setRelation('product', $product), $onOrder[$variant->id] ?? 0, $backOrdered[$variant->id] ?? 0),
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
                // The eStore order's category, chosen for her (she can change it).
                'category' => ProductCategory::fromEstore($orderedItem->purchaseOrder?->category)?->value,
            ],
            // What PROWARE paid per eStore unit, shown beside the Selling Price.
            'costs' => $orderedItem === null ? [] : HeadOfficeCost::latestUnitPrices([$orderedItem->item_code]),
            'today' => now()->toDateString(),
            'categories' => ProductCategory::options(),
            'usedProductCodes' => $this->usedProductCodes(null),
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
                'category' => $product->category->value ?? '',
                'item_code' => $product->item_code ?? '',
                'sold_by_piece' => $product->sold_by_piece,
                'price' => $product->price_centavos === null ? '' : $this->pesos($product->price_centavos),
                'status' => $product->status->value,
                'sale_ends_at' => $product->status === ProductStatus::OnSale ? $product->sale_ends_at?->toIso8601String() : null,
                'preorders_close_on' => $product->preorders_close_on?->toDateString() ?? '',
                'expected_arrival_from' => $product->expected_arrival_from?->toDateString() ?? '',
                'expected_arrival_to' => $product->expected_arrival_to?->toDateString() ?? '',
                'early_bird_price' => $product->early_bird_price_centavos === null ? '' : $this->pesos($product->early_bird_price_centavos),
                'early_bird_pieces' => $product->early_bird_pieces === null ? '' : (string) $product->early_bird_pieces,
                'low_stock_alert_at' => (string) $product->low_stock_alert_at,
                'most_per_buyer' => $product->most_per_buyer === null ? '' : (string) $product->most_per_buyer,
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
                    'status' => $variant->status->value,
                    'estore_item_code' => $variant->estore_item_code ?? '',
                    'estore_pack_key' => $variant->estore_pack_id === null ? '' : (string) $variant->estore_pack_id,
                    'price' => $variant->price_centavos === null ? '' : $this->pesos($variant->price_centavos),
                    'stock_on_hand' => $variant->stock_on_hand,
                ])->all(),
            ],
            'fromItem' => null,
            // What PROWARE paid per eStore unit, shown beside the Selling Price.
            // With the product's own code: what the sizes or colors cost on orders made before each had its own.
            'costs' => HeadOfficeCost::latestUnitPrices(array_values(array_unique(array_filter([...$product->variants->pluck('estore_item_code')->all(), $product->item_code], 'is_string')))),
            'today' => now()->toDateString(),
            'categories' => ProductCategory::options(),
            'usedProductCodes' => $this->usedProductCodes($product->id),
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
        $drafts = $product->status === ProductStatus::Draft ? 0 : $product->variants()->where('status', ProductStatus::Draft)->count();

        $message = "{$product->name} has been saved"
            .($product->status === ProductStatus::Draft ? ' as a draft' : '')
            .($variants > 1 ? " with {$variants} variants" : '').'. '
            .match ($product->status) {
                // Without stock it cannot be Available yet (SaveProductRequest).
                ProductStatus::Draft => $product->variants()->sum('stock_on_hand') > 0
                    ? 'It is not in the store yet; set it to Available when it is ready to sell.'
                    : 'It is not in the store yet.',
                ProductStatus::Preorder => 'It is open for preorders until '.$product->preorders_close_on?->format('M j, Y').' and expected to arrive '.$product->expectedArrivalText().'.',
                ProductStatus::Available => 'It is now in the store for students and STI staff.',
                ProductStatus::OnSale => 'It is currently on sale.',
            };

        if ($drafts > 0) {
            $message .= ' '.($drafts === 1 ? '1 variant stays hidden as a Draft.' : "{$drafts} variants stay hidden as Drafts.");
        }

        if ($piecesAdded > 0) {
            $message .= ' '.number_format($piecesAdded).($piecesAdded === 1 ? ' piece' : ' pieces').' from earlier deliveries '.($piecesAdded === 1 ? 'has' : 'have').' been added to stock.';
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => $message]);
    }

    /**
     * Other products' own Item Codes, so the form can give a new product
     * the next free number (BP-02 after BP-01).
     *
     * @return list<string>
     */
    private function usedProductCodes(?int $exceptProductId): array
    {
        return array_values(Product::query()
            ->whereNotNull('item_code')
            ->when($exceptProductId !== null, fn (Builder $query) => $query->whereKeyNot($exceptProductId))
            ->pluck('item_code')
            ->all());
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
