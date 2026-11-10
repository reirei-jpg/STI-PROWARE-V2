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

        // Undo after Remove: the line is back, ticked as it was before.
        if ($request->boolean('undo_remove')) {
            $cart->keepTickAfterUndo($request->user(), $lines[0]['variant'], $lines[0]['pack'], $request->boolean('selected', true));
        }

        return response()->json([
            'message' => $request->boolean('undo_remove')
                ? Cart::backInCartMessage($lines[0]['variant'], $lines[0]['pack'], $lines[0]['quantity'])
                : Cart::addedManyMessage($lines),
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

        $setKey = $cart->addSet($request->user(), $uniformSet, $request->for(), $top, $bottom, $quantity);

        // Undo after Remove: the set is back, ticked as it was before.
        if ($request->boolean('undo_remove')) {
            $cart->keepSetTickAfterUndo($request->user(), $setKey, $request->boolean('selected', true));
        }

        return response()->json([
            'message' => $request->boolean('undo_remove')
                ? Cart::setBackInCartMessage($uniformSet, $request->for(), $top, $bottom, $quantity)
                : Cart::addedSetMessage($uniformSet, $request->for(), $top, $bottom, $quantity),
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
