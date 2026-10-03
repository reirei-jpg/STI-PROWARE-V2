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
            ->withExists(['variants as has_variant_at_alert' => fn (Builder $variants) => $variants->whereColumn('product_variants.stock_on_hand', '<=', 'products.low_stock_alert_at')])
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
                'sale_price_centavos' => $product->sale_price_centavos,
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
        ]);
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
            'today' => now()->toDateString(),
        ]);
    }

    public function store(SaveProductRequest $request, SaveProduct $saveProduct): RedirectResponse
    {
        $this->flashSaved($saveProduct->handle(new Product, $request));

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
            'today' => now()->toDateString(),
        ]);
    }

    public function update(SaveProductRequest $request, Product $product, SaveProduct $saveProduct): RedirectResponse
    {
        $this->flashSaved($saveProduct->handle($product, $request));

        return to_route('products.index');
    }

    /**
     * "Product saved.", and how many pieces of earlier deliveries went into
     * stock when an eStore Item Code was linked.
     */
    private function flashSaved(int $piecesAdded): void
    {
        Inertia::flash('toast', [
            'type' => 'success',
            'message' => $piecesAdded > 0
                ? 'Product saved. '.number_format($piecesAdded).($piecesAdded === 1 ? ' piece' : ' pieces').' from deliveries already received were added to stock.'
                : 'Product saved.',
        ]);
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
