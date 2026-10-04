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
 * today's price, what can still be ordered, and what to fix first. A line
 * that can no longer be bought as it is (no longer for sale, out of stock,
 * fewer left) blocks Place Order until it is fixed.
 */
final class CartView
{
    /**
     * @return array{lines: list<array<string, mixed>>, total_centavos: int, can_place_order: bool, pick_up_by: string}
     */
    public static function for(User $student): array
    {
        $cart = $student->cartItems()
            ->with(['variant.product.mainPhoto', 'pack.product'])
            ->orderBy('id')
            ->get();

        $lines = array_values($cart->map(fn (CartItem $line): array => self::line($line, $cart))->all());
        $problems = collect($lines)->whereNotNull('problem')->count();

        return [
            'lines' => $lines,
            'total_centavos' => (int) collect($lines)->whereNull('problem')->sum('line_total_centavos'),
            'can_place_order' => $lines !== [] && $problems === 0,
            'pick_up_by' => now()->addDays(Order::PICK_UP_DAYS)->toDateString(),
        ];
    }

    /**
     * @param  Collection<int, CartItem>  $cart
     * @return array{id: int, product_id: int, product_name: string, photo_url: string|null, variant_label: string|null, unit_name: string, pieces_per_unit: int, quantity: int, most_allowed: int, unit_price_centavos: int|null, on_sale: bool, line_total_centavos: int, problem: string|null}
     */
    private static function line(CartItem $line, Collection $cart): array
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
