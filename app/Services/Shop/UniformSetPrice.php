<?php

namespace App\Services\Shop;

use App\Models\CartItem;
use App\Models\ProductVariant;
use App\Models\UniformSet;
use Illuminate\Support\Collection;

/**
 * What a uniform set costs a student today: the set price, or what its two
 * pieces cost bought one by one if that is less (e.g. while one is on
 * sale). The price is shared between the top and the bottom by their
 * prices, so each piece keeps its own price in orders and reports and the
 * two always add up to the set price.
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

        if ($set->set_price_centavos === null || $topPrice === null || $bottomPrice === null) {
            return null;
        }

        $total = min($set->set_price_centavos, $topPrice + $bottomPrice);
        $topShare = (int) round($total * $topPrice / ($topPrice + $bottomPrice));

        return ['top' => $topShare, 'bottom' => $total - $topShare];
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
