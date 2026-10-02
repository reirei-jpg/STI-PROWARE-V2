<?php

namespace App\Http\Controllers;

use App\Enums\ProductStatus;
use App\Http\Requests\FilterStorefrontRequest;
use App\Models\Product;
use App\Services\Storefront\StorefrontProduct;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The public storefront: anyone can browse; signing in is only asked for at
 * Add to Cart or Preorder.
 *
 * - Coming Soon: Preorder products.
 * - On Sale: On Sale products that have stock, the soonest-ending first.
 * - All Merchandise: Available and On Sale products that were ever
 *   received, newest first, sold-out ones last. Products never received
 *   stay hidden, and Draft products are never shown.
 */
class StorefrontController extends Controller
{
    private const RELATIONS = ['mainPhoto', 'packs', 'variants'];

    public function home(FilterStorefrontRequest $request): Response
    {
        $search = $request->search();
        $show = $request->show();

        $feed = Product::query()
            ->whereIn('status', [ProductStatus::Available, ProductStatus::OnSale])
            ->whereHas('variants.stockMovements')
            ->with(self::RELATIONS)
            ->when($search, fn (Builder $query, string $name) => $query->whereLike('name', "%{$name}%"))
            ->when($show === 'in_stock', fn (Builder $query) => $query->whereHas('variants', fn (Builder $variants) => $variants->where('stock_on_hand', '>', 0)))
            ->when($show === 'sold_out', fn (Builder $query) => $query->whereDoesntHave('variants', fn (Builder $variants) => $variants->where('stock_on_hand', '>', 0)))
            ->orderByRaw('case when exists (select 1 from product_variants where product_variants.product_id = products.id and product_variants.stock_on_hand > 0) then 0 else 1 end')
            ->latest('created_at')
            ->latest('id');

        return Inertia::render('storefront/home', [
            'comingSoon' => Product::query()
                ->where('status', ProductStatus::Preorder)
                ->with(self::RELATIONS)
                ->latest('created_at')
                ->latest('id')
                ->limit(20)
                ->get()
                ->map(StorefrontProduct::tile(...))
                ->all(),
            'onSale' => Product::query()
                ->where('status', ProductStatus::OnSale)
                ->whereHas('variants', fn (Builder $variants) => $variants->where('stock_on_hand', '>', 0))
                ->with(self::RELATIONS)
                ->orderBy('sale_ends_at')
                ->latest('id')
                ->limit(8)
                ->get()
                ->map(StorefrontProduct::tile(...))
                ->all(),
            'merchandise' => Inertia::scroll(fn () => $feed
                ->paginate(20)
                ->withQueryString()
                ->through(StorefrontProduct::tile(...))),
            'filters' => [
                'search' => $search,
                'show' => $show,
            ],
        ]);
    }

    /**
     * Everything the view pop-up shows. Draft products do not exist for
     * students.
     */
    public function show(Product $product): JsonResponse
    {
        abort_if($product->status === ProductStatus::Draft, 404);

        $product->load([...self::RELATIONS, 'photos', 'options']);

        return response()->json(StorefrontProduct::details($product));
    }
}
