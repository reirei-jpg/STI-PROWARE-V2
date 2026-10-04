<?php

namespace App\Http\Controllers;

use App\Http\Requests\AddToCartRequest;
use App\Http\Requests\ChangeCartQuantityRequest;
use App\Models\CartItem;
use App\Models\Product;
use App\Services\Shop\Cart;
use App\Services\Shop\CartView;
use App\Services\Stock\Units;
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
            'message' => 'Added '.Units::count($quantity, $pack->name ?? 'Piece')." of {$variant->displayName()} to your cart.",
        ]);

        return back();
    }

    public function update(ChangeCartQuantityRequest $request, CartItem $cartItem, Cart $cart): RedirectResponse
    {
        abort_unless($cartItem->user_id === $request->user()->id, 404);

        $cart->changeQuantity($cartItem, $request->integer('quantity'));

        return back();
    }

    public function destroy(Request $request, CartItem $cartItem): RedirectResponse
    {
        abort_unless($cartItem->user_id === $request->user()->id, 404);

        $cartItem->delete();

        return back();
    }
}
