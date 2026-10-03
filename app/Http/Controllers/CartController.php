<?php

namespace App\Http\Controllers;

use App\Enums\ProductStatus;
use App\Http\Requests\AddToCartRequest;
use App\Models\CartItem;
use App\Models\Order;
use App\Models\Product;
use App\Services\Shop\Cart;
use App\Services\Shop\ShopPrice;
use App\Services\Stock\Units;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * A student's cart: what they chose, at today's prices, and Place Order.
 * They pay in cash at the PROWARE office when they pick the order up.
 */
class CartController extends Controller
{
    /**
     * The cart page. A line that can no longer be bought as it is (no longer
     * for sale, out of stock, fewer left) says what to do, and the order
     * cannot be placed until it is fixed.
     */
    public function index(Request $request): Response
    {
        $cart = $request->user()->cartItems()
            ->with(['variant.product.mainPhoto', 'pack.product'])
            ->orderBy('id')
            ->get();

        $lines = $cart->map(fn (CartItem $line): array => $this->line($line, $cart))->all();
        $problems = collect($lines)->whereNotNull('problem')->count();

        return Inertia::render('storefront/cart', [
            'lines' => $lines,
            'total_centavos' => (int) collect($lines)->whereNull('problem')->sum('line_total_centavos'),
            'can_place_order' => $lines !== [] && $problems === 0,
            'pick_up_by' => now()->addDays(Order::PICK_UP_DAYS)->toDateString(),
        ]);
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

    public function update(Request $request, CartItem $cartItem, Cart $cart): RedirectResponse
    {
        abort_unless($cartItem->user_id === $request->user()->id, 404);

        $validated = $request->validate(
            ['quantity' => ['required', 'integer', 'min:1', 'max:'.Cart::MAX_QUANTITY]],
            [
                'quantity.min' => 'Keep at least 1, or remove the item.',
                'quantity.max' => 'For more than '.number_format(Cart::MAX_QUANTITY).', please talk to the PROWARE office.',
            ],
        );

        $cart->changeQuantity($cartItem, (int) $validated['quantity']);

        return back();
    }

    public function destroy(Request $request, CartItem $cartItem): RedirectResponse
    {
        abort_unless($cartItem->user_id === $request->user()->id, 404);

        $cartItem->delete();

        return back();
    }

    /**
     * @param  Collection<int, CartItem>  $cart
     * @return array{id: int, product_id: int, product_name: string, photo_url: string|null, variant_label: string|null, unit_name: string, pieces_per_unit: int, quantity: int, most_allowed: int, unit_price_centavos: int|null, on_sale: bool, line_total_centavos: int, problem: string|null}
     */
    private function line(CartItem $line, Collection $cart): array
    {
        $variant = $line->variant;
        $product = $variant->product;
        $piecesPerUnit = $line->pack->pieces ?? 1;
        $unitPrice = ShopPrice::canBuy($product) ? ShopPrice::perUnit($variant, $line->pack) : null;

        $piecesInOtherLines = $cart
            ->filter(fn (CartItem $other): bool => $other->product_variant_id === $line->product_variant_id && $other->id !== $line->id)
            ->sum(fn (CartItem $other): int => $other->pieces());
        $mostAllowed = Cart::mostOf($variant->stock_on_hand, (int) $piecesInOtherLines, $piecesPerUnit);

        $problem = match (true) {
            $unitPrice === null => 'No longer for sale. Remove it to place your order.',
            $variant->stock_on_hand === 0 => 'Out of stock. Remove it to place your order.',
            $mostAllowed === 0 => 'Not enough left for this. Remove it to place your order.',
            $line->quantity > $mostAllowed => 'Only '.Units::count($mostAllowed, $line->pack->name ?? 'Piece').' can be ordered now. Lower the quantity.',
            default => null,
        };

        return [
            'id' => $line->id,
            'product_id' => $product->id,
            'product_name' => $product->name,
            'photo_url' => $product->mainPhoto?->url(),
            'variant_label' => $variant->choices === [] ? null : $variant->label(),
            'unit_name' => $line->pack->name ?? 'Piece',
            'pieces_per_unit' => $piecesPerUnit,
            'quantity' => $line->quantity,
            'most_allowed' => $mostAllowed,
            'unit_price_centavos' => $unitPrice,
            'on_sale' => $line->pack === null ? $variant->salePiecePrice() !== null : $product->status === ProductStatus::OnSale && $line->pack->sale_price_centavos !== null,
            'line_total_centavos' => ($unitPrice ?? 0) * $line->quantity,
            'problem' => $problem,
        ];
    }
}
