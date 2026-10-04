<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\AddToCartRequest;
use App\Http\Requests\ChangeCartQuantityRequest;
use App\Models\CartItem;
use App\Models\Product;
use App\Services\Shop\Cart;
use App\Services\Shop\CartView;
use App\Services\Stock\Units;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The student's cart on the phone app, with the website's rules (Cart,
 * CartView). Every change answers with the whole cart again.
 */
class CartController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json(CartView::for($request->user()));
    }

    public function store(AddToCartRequest $request, Product $product, Cart $cart): JsonResponse
    {
        $variant = $request->variant();
        $pack = $request->pack();
        $quantity = $request->integer('quantity');

        $cart->add($request->user(), $variant, $pack, $quantity);

        return response()->json([
            'message' => 'Added '.Units::count($quantity, $pack->name ?? 'Piece')." of {$variant->displayName()} to your cart.",
            'cart' => CartView::for($request->user()),
        ], 201);
    }

    public function update(ChangeCartQuantityRequest $request, CartItem $cartItem, Cart $cart): JsonResponse
    {
        abort_unless($cartItem->user_id === $request->user()->id, 404);

        $cart->changeQuantity($cartItem, $request->integer('quantity'));

        return response()->json(['cart' => CartView::for($request->user())]);
    }

    public function destroy(Request $request, CartItem $cartItem): JsonResponse
    {
        abort_unless($cartItem->user_id === $request->user()->id, 404);

        $cartItem->delete();

        return response()->json(['cart' => CartView::for($request->user())]);
    }
}
