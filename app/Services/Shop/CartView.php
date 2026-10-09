<?php

namespace App\Services\Shop;

use App\Enums\ProductStatus;
use App\Models\CartItem;
use App\Models\Order;
use App\Models\User;
use App\Services\Stock\Units;
use Illuminate\Database\Eloquent\Collection;

/**
 * A student's cart as the website and the phone app show it: each line at
 * today's price, whether it is ticked for the next Place Order, and what to
 * fix first. Only ticked lines are ordered and counted in the total; a
 * ticked line that can no longer be bought as it is (no longer for sale,
 * out of stock, fewer left) blocks Place Order until it is fixed or
 * unticked.
 */
final class CartView
{
    /**
     * With the student's saved course/section (for the issuance slip) and,
     * when a guard would refuse the order (too many waiting, or paused), why.
     *
     * @return array{lines: list<array<string, mixed>>, selected_count: int, total_centavos: int, can_place_order: bool, pick_up_by: string, section: string|null, order_refusal: string|null}
     */
    public static function for(User $student): array
    {
        $cart = $student->cartItems()
            ->with(['variant.product.mainPhoto', 'pack.product'])
            ->orderBy('id')
            ->get();

        $lines = array_values($cart->map(fn (CartItem $line): array => self::line($line, $cart))->all());
        $ticked = collect($lines)->where('selected', true);

        return [
            'lines' => $lines,
            'selected_count' => $ticked->count(),
            'total_centavos' => (int) $ticked->whereNull('problem')->sum('line_total_centavos'),
            'can_place_order' => $ticked->isNotEmpty() && $ticked->whereNotNull('problem')->isEmpty(),
            'pick_up_by' => OrderRules::holdUntil()->toDateString(),
            'section' => $student->section,
            'order_refusal' => $lines === [] ? null : OrderRules::refusal($student),
        ];
    }

    /**
     * @param  Collection<int, CartItem>  $cart
     * @return array{id: int, product_id: int, product_name: string, photo_url: string|null, variant_label: string|null, unit_name: string, pieces_per_unit: int, quantity: int, selected: bool, most_allowed: int, unit_price_centavos: int|null, on_sale: bool, line_total_centavos: int, problem: string|null}
     */
    private static function line(CartItem $line, Collection $cart): array
    {
        $variant = $line->variant;
        $product = $variant->product;
        $piecesPerUnit = $line->pack->pieces ?? 1;
        $unitPrice = ShopPrice::canBuy($product) ? ShopPrice::perUnit($variant, $line->pack) : null;

        $otherLines = $cart->filter(fn (CartItem $other): bool => $other->product_variant_id === $line->product_variant_id && $other->id !== $line->id);

        // How many more fit in the cart at all (the + button's limit).
        $mostAllowed = Cart::mostOf($variant->freeToSell(), (int) $otherLines->sum(fn (CartItem $other): int => $other->pieces()), $piecesPerUnit);

        // How many can be ordered with the other ticked lines, as Place
        // Order will take them; lines set aside do not count.
        $mostOrderable = Cart::mostOf($variant->freeToSell(), (int) $otherLines->where('selected', true)->sum(fn (CartItem $other): int => $other->pieces()), $piecesPerUnit);

        $problem = match (true) {
            $unitPrice === null => 'No longer for sale. Remove it, or untick it to order the rest.',
            $variant->freeToSell() === 0 => 'Out of stock. Remove it, or untick it to order the rest.',
            $mostOrderable === 0 => 'Not enough left for this. Remove it, or untick it to order the rest.',
            $line->quantity > $mostOrderable => 'Only '.Units::count($mostOrderable, $line->pack->name ?? 'Piece').' can be ordered now. Lower the quantity.',
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
            'selected' => $line->selected,
            'most_allowed' => $mostAllowed,
            'unit_price_centavos' => $unitPrice,
            'on_sale' => $line->pack === null ? $variant->salePiecePrice() !== null : $product->status === ProductStatus::OnSale && $line->pack->sale_price_centavos !== null,
            'line_total_centavos' => ($unitPrice ?? 0) * $line->quantity,
            'problem' => $problem,
        ];
    }
}
