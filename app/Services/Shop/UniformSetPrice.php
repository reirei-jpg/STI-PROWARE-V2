<?php

namespace App\Services\Shop;

use App\Models\CartItem;
use App\Models\ProductVariant;
use App\Models\UniformSet;
use Illuminate\Support\Collection;

/**
 * What a uniform set costs a student today: what its top and its bottom
 * cost (a piece on sale makes the set cheaper too). A set is only a way to
 * buy both at once; each piece keeps its own price in orders and reports.
 */
final class UniformSetPrice
{
    /**
     * @return array{top: int, bottom: int}|null centavos per piece; null when a piece cannot be bought by the piece now
     */
    public static function shares(UniformSet $set, ProductVariant $top, ProductVariant $bottom): ?array
    {
        $topPrice = ShopPrice::canBuy($top->product) ? ShopPrice::perPiece($top) : null;
        $bottomPrice = ShopPrice::canBuy($bottom->product) ? ShopPrice::perPiece($bottom) : null;

        if (! $set->sold_as_set || $topPrice === null || $bottomPrice === null) {
            return null;
        }

        return ['top' => $topPrice, 'bottom' => $bottomPrice];
    }

    /**
     * Today's price of one piece for each line of the cart that is part of a
     * set, by cart line id. Lines whose set cannot be bought now get null.
     *
     * @param  Collection<int, CartItem>  $cart  with variant.product and uniformSet
     * @return array<int, int|null>
     */
    public static function forCart(Collection $cart): array
    {
        $prices = [];

        foreach ($cart->whereNotNull('set_key')->groupBy('set_key') as $lines) {
            [$top, $bottom] = self::topAndBottom($lines);
            $shares = $top !== null && $bottom !== null && $top->uniformSet !== null
                ? self::shares($top->uniformSet, $top->variant, $bottom->variant)
                : null;

            foreach ($lines as $line) {
                $prices[$line->id] = $shares === null ? null : ($line->is($top) ? $shares['top'] : $shares['bottom']);
            }
        }

        return $prices;
    }

    /**
     * A set's top line (the polo or blouse) and bottom line.
     *
     * @param  Collection<int, CartItem>  $lines  the two lines of one set
     * @return array{0: CartItem|null, 1: CartItem|null}
     */
    public static function topAndBottom(Collection $lines): array
    {
        $first = $lines->first();
        $topProductId = $first?->set_for === null ? null : $first->uniformSet?->topForSale($first->set_for);

        return [
            $lines->first(fn (CartItem $line): bool => $line->variant->product_id === $topProductId),
            $lines->first(fn (CartItem $line): bool => $line->variant->product_id !== $topProductId),
        ];
    }
}
