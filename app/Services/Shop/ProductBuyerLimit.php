<?php

namespace App\Services\Shop;

use App\Enums\OrderStatus;
use App\Enums\PreorderStatus;
use App\Models\CartItem;
use App\Models\OrderItem;
use App\Models\Preorder;
use App\Models\Product;
use App\Models\User;
use App\Services\Stock\Units;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The most pieces of one product a buyer can get (the product's "Most per
 * buyer", optional; panel revision, 20 Nov 2026), so e.g. 10 shirts reach 5
 * buyers instead of 1. All its sizes and colors count together, by the
 * piece. It counts everything the buyer has of it that was not cancelled:
 * their cart, their orders (waiting or released) and their preorders still
 * waiting or paid. Uniform sets are not counted and not limited.
 */
final class ProductBuyerLimit
{
    /** The highest limit the Specialist can type. */
    public const MAX = 10000;

    /** Where the pieces a buyer already has are, in the messages. */
    public const EVERYWHERE = 'in your cart, orders or preorders';

    /**
     * Pieces of the product the buyer already has.
     *
     * @param  list<int>  $exceptCartItemIds  cart lines being changed (or ordered now)
     */
    public static function taken(User $buyer, Product $product, array $exceptCartItemIds = [], ?int $exceptPreorderId = null, bool $withCart = true): int
    {
        $inCart = ! $withCart ? 0 : (int) $buyer->cartItems()
            ->with('pack')
            ->whereNull('set_key')
            ->whereHas('variant', fn (Builder $variants) => $variants->where('product_id', $product->id))
            ->when($exceptCartItemIds !== [], fn (Builder $lines) => $lines->whereKeyNot($exceptCartItemIds))
            ->get()
            ->sum(fn (CartItem $line): int => $line->pieces());

        // Released orders count what was handed over (not what was short).
        $ordered = (int) OrderItem::query()
            ->where('product_id', $product->id)
            ->whereNull('set_key')
            ->whereHas('order', fn (Builder $orders) => $orders->where('user_id', $buyer->id)->where('status', '!=', OrderStatus::Cancelled))
            ->sum(DB::raw('(quantity - quantity_short) * pieces_per_unit'));

        // Waiting, or paid and set aside; once ordered, the order counts them.
        $preordered = (int) Preorder::query()
            ->where('user_id', $buyer->id)
            ->where('product_id', $product->id)
            ->whereIn('status', [PreorderStatus::Active, PreorderStatus::Held])
            ->when($exceptPreorderId !== null, fn (Builder $preorders) => $preorders->whereKeyNot($exceptPreorderId))
            ->sum('quantity');

        return $inCart + $ordered + $preordered;
    }

    /**
     * Refuse when $pieces more of the product would go over its limit.
     *
     * @param  list<int>  $exceptCartItemIds
     *
     * @throws ValidationException on $field
     */
    public static function ensure(User $buyer, Product $product, int $pieces, string $field, array $exceptCartItemIds = [], ?int $exceptPreorderId = null, bool $withCart = true): void
    {
        if ($product->most_per_buyer === null) {
            return;
        }

        $taken = self::taken($buyer, $product, $exceptCartItemIds, $exceptPreorderId, $withCart);

        if ($taken + $pieces > $product->most_per_buyer) {
            throw ValidationException::withMessages([$field => self::message($product, $taken, $withCart ? self::EVERYWHERE : 'in your orders or preorders')]);
        }
    }

    /**
     * How many more pieces the buyer can get; null when the product has no
     * limit of its own.
     */
    public static function left(User $buyer, Product $product): ?int
    {
        return $product->most_per_buyer === null ? null : max(0, $product->most_per_buyer - self::taken($buyer, $product));
    }

    /**
     * "Each buyer can get at most 2 pcs of STI Shirt. You already have 1 pc
     * in your cart, orders or preorders, so you can get 1 pc more."
     */
    public static function message(Product $product, int $taken, string $where = self::EVERYWHERE): string
    {
        $most = (int) $product->most_per_buyer;
        $limit = 'Each buyer can get at most '.Units::count($most, 'Piece')." of {$product->name}";

        return match (true) {
            $taken <= 0 => "{$limit}.",
            $taken >= $most => "{$limit}, and you already have ".Units::count($taken, 'Piece')." {$where}.",
            default => "{$limit}. You already have ".Units::count($taken, 'Piece')." {$where}, so you can get ".Units::count($most - $taken, 'Piece').' more.',
        };
    }
}
