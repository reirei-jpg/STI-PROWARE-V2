<?php

namespace App\Http\Controllers;

use App\Http\Requests\AddToWishlistRequest;
use App\Models\CartItem;
use App\Models\Product;
use App\Models\WishlistItem;
use App\Services\Shop\Wishlist;
use Closure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * A buyer's wishlist (panel revision, 20 Nov 2026): Add to Wishlist from an
 * item's Add to Cart window, Move to wishlist from the cart, and the My
 * Wishlist page. The phone app has the same (Api\V1\WishlistController).
 */
class WishlistController extends Controller
{
    public function index(Request $request): Response
    {
        return Inertia::render('storefront/wishlist', [
            'items' => Wishlist::view($request->user()),
        ]);
    }

    public function store(AddToWishlistRequest $request, Product $product, Wishlist $wishlist): RedirectResponse
    {
        return $this->respond(fn (): string => $wishlist->add($request->user(), $request->product(), $request->variant()));
    }

    public function destroy(Request $request, WishlistItem $wishlistItem, Wishlist $wishlist): RedirectResponse
    {
        abort_unless($wishlistItem->user_id === $request->user()->id, 404);

        return $this->respond(fn (): string => $wishlist->remove($wishlistItem));
    }

    /**
     * Move to wishlist, from the cart.
     */
    public function moveFromCart(Request $request, CartItem $cartItem, Wishlist $wishlist): RedirectResponse
    {
        abort_unless($cartItem->user_id === $request->user()->id, 404);

        return $this->respond(fn (): string => $wishlist->moveFromCart($cartItem));
    }

    /**
     * What happened, or why it was refused, as a toast.
     *
     * @param  Closure(): string  $step
     */
    private function respond(Closure $step): RedirectResponse
    {
        try {
            Inertia::flash('toast', ['type' => 'success', 'kind' => 'wishlist', 'message' => $step()]);
        } catch (ValidationException $refused) {
            Inertia::flash('toast', ['type' => 'error', 'message' => $refused->validator->errors()->first()]);
        }

        return back();
    }
}
