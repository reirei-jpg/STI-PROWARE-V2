<?php

namespace App\Http\Controllers;

use App\Http\Requests\FilterStorefrontRequest;
use App\Models\Product;
use App\Services\Storefront\StorefrontFeed;
use App\Services\Storefront\StorefrontProduct;
use Illuminate\Http\JsonResponse;
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
        $show = $request->show();

        return Inertia::render('storefront/home', [
            'comingSoon' => StorefrontFeed::comingSoon(),
            'onSale' => StorefrontFeed::onSale(),
            'merchandise' => Inertia::scroll(fn () => StorefrontFeed::merchandise($search, $show)
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
        return response()->json(StorefrontProduct::forStudents($product));
    }
}
