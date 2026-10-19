<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\AddSetToCartRequest;
use App\Http\Requests\AddToCartRequest;
use App\Http\Requests\ChangeCartQuantityRequest;
use App\Http\Requests\SelectCartItemsRequest;
use App\Models\CartItem;
use App\Models\Product;
use App\Models\UniformSet;
use App\Services\Shop\Cart;
use App\Services\Shop\CartView;
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
        $lines = $request->lines();

        $cart->addMany($request->user(), $lines, $request->fieldFor(...));

        return response()->json([
            'message' => Cart::addedManyMessage($lines),
            'cart' => CartView::for($request->user()),
        ], 201);
    }

    /**
     * Add a uniform set: its top and bottom, with the sizes chosen.
     */
    public function storeSet(AddSetToCartRequest $request, UniformSet $uniformSet, Cart $cart): JsonResponse
    {
        $top = $request->top();
        $bottom = $request->bottom();
        $quantity = $request->integer('quantity');

        $cart->addSet($request->user(), $uniformSet, $request->for(), $top, $bottom, $quantity);

        return response()->json([
            'message' => Cart::addedSetMessage($uniformSet, $request->for(), $top, $bottom, $quantity),
            'cart' => CartView::for($request->user()),
        ], 201);
    }

    public function update(ChangeCartQuantityRequest $request, CartItem $cartItem, Cart $cart): JsonResponse
    {
        abort_unless($cartItem->user_id === $request->user()->id, 404);

        $cart->changeQuantity($cartItem, $request->integer('quantity'));

        return response()->json(['cart' => CartView::for($request->user())]);
    }

    /**
     * Tick or untick lines for the next Place Order.
     */
    public function select(SelectCartItemsRequest $request, Cart $cart): JsonResponse
    {
        $cart->select($request->user(), $request->cartItemIds(), $request->boolean('selected'));

        return response()->json(['cart' => CartView::for($request->user())]);
    }

    public function destroy(Request $request, CartItem $cartItem, Cart $cart): JsonResponse
    {
        abort_unless($cartItem->user_id === $request->user()->id, 404);

        $cart->remove($cartItem);

        return response()->json(['cart' => CartView::for($request->user())]);
    }
}
