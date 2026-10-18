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
 * They pay in cash at the PROWARE office when they pick the order up. The
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
        $variant = $request->variant();
        $pack = $request->pack();
        $quantity = $request->integer('quantity');

        $cart->add($request->user(), $variant, $pack, $quantity);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => Cart::addedMessage($variant, $pack, $quantity),
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

        $cart->addSet($request->user(), $uniformSet, $request->for(), $top, $bottom, $quantity);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => Cart::addedSetMessage($uniformSet, $request->for(), $top, $bottom, $quantity),
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
