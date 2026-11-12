<?php

namespace App\Http\Controllers;

use App\Http\Requests\FilterStorefrontRequest;
use App\Models\Product;
use App\Services\Shop\BuyerLimit;
use App\Services\Storefront\StorefrontFeed;
use App\Services\Storefront\StorefrontProduct;
use App\Services\Storefront\StorefrontUniformSets;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The public storefront: anyone can browse; signing in is only asked for at
 * Add to Cart or Preorder. The sections are in StorefrontFeed, shared with
 * the phone app.
 */
class StorefrontController extends Controller
{
    public function home(FilterStorefrontRequest $request): Response
    {
        $search = $request->search();
        $find = $request->find();
        $show = $request->show();

        return Inertia::render('storefront/home', [
            'comingSoon' => StorefrontFeed::comingSoon($search),
            'onSale' => StorefrontFeed::onSale($search),
            'uniformSets' => StorefrontUniformSets::all($search),
            // The most uniform sets this buyer can add at once (BuyerLimit).
            'mostPerItem' => BuyerLimit::for($request->user()),
            'spotlight' => StorefrontFeed::spotlight(),
            'merchandise' => Inertia::scroll(fn () => StorefrontFeed::merchandise($search, $show, $find)
                ->paginate(20)
                ->withQueryString()
                ->through(StorefrontProduct::tile(...))),
            'filters' => [
                'search' => $search,
                'find' => $find,
                'show' => $show,
            ],
        ]);
    }

    /**
     * Everything the view pop-up shows. Draft products do not exist for
     * students.
     */
    public function show(Request $request, Product $product): JsonResponse
    {
        return response()->json(StorefrontProduct::forStudents($product, $request->user()));
    }
}
