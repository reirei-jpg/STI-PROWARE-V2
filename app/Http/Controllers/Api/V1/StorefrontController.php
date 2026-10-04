<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\FilterStorefrontRequest;
use App\Models\Product;
use App\Services\Storefront\StorefrontFeed;
use App\Services\Storefront\StorefrontProduct;
use Illuminate\Http\JsonResponse;

/**
 * The storefront on the phone app: the same sections and product views as
 * the website (StorefrontFeed, StorefrontProduct).
 */
class StorefrontController extends Controller
{
    /**
     * Coming Soon and On Sale, for the top of the Home screen.
     */
    public function home(): JsonResponse
    {
        return response()->json([
            'coming_soon' => StorefrontFeed::comingSoon(),
            'on_sale' => StorefrontFeed::onSale(),
        ]);
    }

    /**
     * All Merchandise, 20 at a time, by name and Available / Out of Stock.
     */
    public function merchandise(FilterStorefrontRequest $request): JsonResponse
    {
        return response()->json(StorefrontFeed::merchandise($request->search(), $request->show())
            ->paginate(20)
            ->withQueryString()
            ->through(StorefrontProduct::tile(...)));
    }

    /**
     * One product's view: photos, options, sizes or colors with today's
     * prices and stock, and the packs students can buy.
     */
    public function show(Product $product): JsonResponse
    {
        return response()->json(StorefrontProduct::forStudents($product));
    }
}
