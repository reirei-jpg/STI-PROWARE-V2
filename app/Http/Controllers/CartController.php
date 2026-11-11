<?php

namespace App\Http\Controllers;

use App\Http\Requests\AddSetToCartRequest;
use App\Http\Requests\AddToCartRequest;
use App\Http\Requests\ChangeCartQuantityRequest;
use App\Http\Requests\SelectCartItemsRequest;
use App\Models\CartItem;
use App\Models\Product;
use App\Models\UniformSet;
use App\Services\Shop\Cart;
use App\Services\Shop\CartView;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * A student's cart: what they chose, at today's prices, and Place Order.
 * They pay at the cashier and show the receipt at the PROWARE office when
 * they pick the order up. The
 * phone app shows the same cart (see Api\V1\CartController).
 */
class CartController extends Controller
{
    /**
     * The cart page. A line that can no longer be bought as it is says what
     * to do, and the order cannot be placed until it is fixed.
     */
    public function index(Request $request): Response
    {
        return Inertia::render('storefront/cart', CartView::for($request->user()));
    }

    public function store(AddToCartRequest $request, Product $product, Cart $cart): RedirectResponse
    {
        $lines = $request->lines();

        $cart->addMany($request->user(), $lines, $request->fieldFor(...));

        // Undo after Remove: the line is back, ticked as it was before.
        if ($request->boolean('undo_remove')) {
            $cart->keepTickAfterUndo($request->user(), $lines[0]['variant'], $lines[0]['pack'], $request->boolean('selected', true));
        }

        Inertia::flash('toast', [
            'type' => 'success',
            'kind' => 'cart',
            'message' => $request->boolean('undo_remove')
                ? Cart::backInCartMessage($lines[0]['variant'], $lines[0]['pack'], $lines[0]['quantity'])
                : Cart::addedManyMessage($lines),
        ]);

        return back();
    }

    /**
     * Add a uniform set: its top and bottom, with the sizes chosen.
     */
    public function storeSet(AddSetToCartRequest $request, UniformSet $uniformSet, Cart $cart): RedirectResponse
    {
        $top = $request->top();
        $bottom = $request->bottom();
        $quantity = $request->integer('quantity');

        $setKey = $cart->addSet($request->user(), $uniformSet, $request->for(), $top, $bottom, $quantity);

        // Undo after Remove: the set is back, ticked as it was before.
        if ($request->boolean('undo_remove')) {
            $cart->keepSetTickAfterUndo($request->user(), $setKey, $request->boolean('selected', true));
        }

        Inertia::flash('toast', [
            'type' => 'success',
            'kind' => 'cart',
            'message' => $request->boolean('undo_remove')
                ? Cart::setBackInCartMessage($uniformSet, $request->for(), $top, $bottom, $quantity)
                : Cart::addedSetMessage($uniformSet, $request->for(), $top, $bottom, $quantity),
        ]);

        return back();
    }

    public function update(ChangeCartQuantityRequest $request, CartItem $cartItem, Cart $cart): RedirectResponse
    {
        abort_unless($cartItem->user_id === $request->user()->id, 404);

        $cart->changeQuantity($cartItem, $request->integer('quantity'));

        return back();
    }

    /**
     * Tick or untick lines for the next Place Order.
     */
    public function select(SelectCartItemsRequest $request, Cart $cart): RedirectResponse
    {
        $cart->select($request->user(), $request->cartItemIds(), $request->boolean('selected'));

        return back();
    }

    public function destroy(Request $request, CartItem $cartItem, Cart $cart): RedirectResponse
    {
        abort_unless($cartItem->user_id === $request->user()->id, 404);

        $cart->remove($cartItem);

        return back();
    }
}
