<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\AddToWishlistRequest;
use App\Models\CartItem;
use App\Models\Product;
use App\Models\WishlistItem;
use App\Services\Shop\CartView;
use App\Services\Shop\Wishlist;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The buyer's wishlist on the phone app, with the website's rules
 * (Wishlist). Every change answers with the whole wishlist again (and the
 * cart, after Move to wishlist). A refusal answers 422 with its reason.
 */
class WishlistController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json(['items' => Wishlist::view($request->user())]);
    }

    public function store(AddToWishlistRequest $request, Product $product, Wishlist $wishlist): JsonResponse
    {
        $message = $wishlist->add($request->user(), $request->product(), $request->variant());

        return response()->json(['message' => $message, 'items' => Wishlist::view($request->user())], 201);
    }

    public function destroy(Request $request, WishlistItem $wishlistItem, Wishlist $wishlist): JsonResponse
    {
        abort_unless($wishlistItem->user_id === $request->user()->id, 404);

        $message = $wishlist->remove($wishlistItem);

        return response()->json(['message' => $message, 'items' => Wishlist::view($request->user())]);
    }

    public function moveFromCart(Request $request, CartItem $cartItem, Wishlist $wishlist): JsonResponse
    {
        abort_unless($cartItem->user_id === $request->user()->id, 404);

        $message = $wishlist->moveFromCart($cartItem);

        return response()->json(['message' => $message, 'cart' => CartView::for($request->user())]);
    }
}
