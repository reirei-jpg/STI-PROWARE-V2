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
 *
 * A uniform set's two lines each carry the set (its key, name, who it is
 * for, its price): the screens show them as one line, with the most that
 * fits and what to fix for the set as a whole.
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
            ->with(['variant.product.mainPhoto', 'pack.product', 'uniformSet'])
            ->orderBy('id')
            ->get();
        $setPrices = UniformSetPrice::forCart($cart);

        $lines = self::joinSets(array_values($cart->map(fn (CartItem $line): array => self::line($line, $cart, $setPrices))->all()));
        $ticked = collect($lines)->where('selected', true);

        return [
            'lines' => $lines,
            // A set's two lines count as one item.
            'selected_count' => $ticked->unique(fn (array $line): string => $line['set']['key'] ?? 'line-'.$line['id'])->count(),
            'total_centavos' => (int) $ticked->whereNull('problem')->sum('line_total_centavos'),
            'can_place_order' => $ticked->isNotEmpty() && $ticked->whereNotNull('problem')->isEmpty(),
            'pick_up_by' => OrderRules::holdUntil()->toDateString(),
            'section' => $student->section,
            'order_refusal' => $lines === [] ? null : OrderRules::refusal($student),
        ];
    }

    /**
     * A set's two lines get the smallest most-allowed of the two and the
     * first thing to fix, so the set is changed and fixed as one.
     *
     * @param  list<array<string, mixed>>  $lines
     * @return list<array<string, mixed>>
     */
    private static function joinSets(array $lines): array
    {
        $bySet = collect($lines)->filter(fn (array $line): bool => $line['set'] !== null)->groupBy(fn (array $line): string => $line['set']['key']);

        return array_map(function (array $line) use ($bySet): array {
            if ($line['set'] === null) {
                return $line;
            }

            $setLines = $bySet->get($line['set']['key']);
            $line['most_allowed'] = (int) $setLines->min('most_allowed');
            $line['problem'] = $setLines->pluck('problem')->filter()->first()
                ?? ($setLines->count() < 2 ? 'Part of this set is no longer in the store. Remove it.' : null);

            return $line;
        }, $lines);
    }

    /**
     * @param  Collection<int, CartItem>  $cart
     * @param  array<int, int|null>  $setPrices  today's price per piece of set lines, by line id
     * @return array{id: int, product_id: int, product_name: string, photo_url: string|null, variant_label: string|null, unit_name: string, pieces_per_unit: int, quantity: int, selected: bool, most_allowed: int, unit_price_centavos: int|null, on_sale: bool, line_total_centavos: int, problem: string|null, set: array{key: string, name: string, for_label: string, price_centavos: int|null}|null}
     */
    private static function line(CartItem $line, Collection $cart, array $setPrices): array
    {
        $variant = $line->variant;
        $product = $variant->product;
        $piecesPerUnit = $line->pack->pieces ?? 1;
        $inSet = $line->set_key !== null;
        $unitPrice = match (true) {
            $inSet => $setPrices[$line->id] ?? null,
            ShopPrice::canBuy($product) => ShopPrice::perUnit($variant, $line->pack),
            default => null,
        };
        $setPrice = $inSet
            ? collect($setPrices)->only($cart->where('set_key', $line->set_key)->modelKeys())->filter(fn (?int $price): bool => $price !== null)->sum()
            : 0;

        $otherLines = $cart->filter(fn (CartItem $other): bool => $other->product_variant_id === $line->product_variant_id && $other->id !== $line->id);

        // How many more fit in the cart at all (the + button's limit).
        $mostAllowed = Cart::mostOf($variant->freeToSell(), (int) $otherLines->sum(fn (CartItem $other): int => $other->pieces()), $piecesPerUnit);

        // How many can be ordered with the other ticked lines, as Place
        // Order will take them; lines set aside do not count.
        $mostOrderable = Cart::mostOf($variant->freeToSell(), (int) $otherLines->where('selected', true)->sum(fn (CartItem $other): int => $other->pieces()), $piecesPerUnit);

        $problem = match (true) {
            $unitPrice === null && $inSet => 'This set is no longer for sale as it is. Remove it, or untick it to order the rest.',
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
            'on_sale' => ! $inSet && ($line->pack === null ? $variant->salePiecePrice() !== null : $product->status === ProductStatus::OnSale && $line->pack->sale_price_centavos !== null),
            'line_total_centavos' => ($unitPrice ?? 0) * $line->quantity,
            'problem' => $problem,
            'set' => $inSet && $line->uniformSet !== null && $line->set_for !== null ? [
                'key' => (string) $line->set_key,
                'name' => $line->uniformSet->displayName(),
                'for_label' => $line->set_for->label(),
                // One set, today: the top and bottom together.
                'price_centavos' => $unitPrice === null ? null : (int) $setPrice,
            ] : null,
        ];
    }
}
