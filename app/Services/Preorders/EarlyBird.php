<?php

namespace App\Services\Preorders;

use App\Enums\PreorderStatus;
use App\Enums\ProductStatus;
use App\Models\Preorder;
use App\Models\Product;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * The early-bird price of a Preorder product: the first N pieces preordered
 * get it, first come, first served, counted per piece across all sizes.
 *
 * Pieces a preorder already got stay with it; free early-bird pieces (from
 * a cancelled or smaller preorder, or a larger N) go to the earliest
 * preorders still short of early-bird pieces. So a student who preorders
 * more later only gets early-bird pieces that are still free, and when an
 * early preorder is cancelled the next ones move up. When N is made smaller,
 * the latest preorders give theirs back first.
 */
final class EarlyBird
{
    /**
     * Recount after a preorder was placed, changed or cancelled, or the
     * Specialist changed the early-bird price or pieces. Only while the
     * product is a Preorder product (after that, the counts stay as they
     * were when it arrived).
     */
    public static function reallocate(Product $product): void
    {
        // One recount at a time per product, so two students preordering at
        // the same moment never get more early-bird pieces than there are.
        DB::transaction(function () use ($product): void {
            $locked = Product::query()->lockForUpdate()->find($product->id);

            if ($locked !== null) {
                self::recount($locked);
            }
        });
    }

    private static function recount(Product $product): void
    {
        if ($product->status !== ProductStatus::Preorder) {
            return;
        }

        $preorders = self::counted($product);
        $limit = $product->early_bird_price_centavos === null ? 0 : (int) $product->early_bird_pieces;

        // Not active any more, or fewer pieces than it got: give them back.
        Preorder::query()
            ->where('product_id', $product->id)
            ->where('status', '!=', PreorderStatus::Active)
            ->where('early_bird_pieces', '>', 0)
            ->update(['early_bird_pieces' => 0]);

        foreach ($preorders as $preorder) {
            $preorder->early_bird_pieces = min($preorder->early_bird_pieces, $preorder->quantity);
        }

        // Fewer early-bird pieces than given: the latest give theirs back.
        $over = self::given($preorders) - $limit;

        foreach ($preorders->reverse() as $preorder) {
            if ($over <= 0) {
                break;
            }

            $taken = min($over, $preorder->early_bird_pieces);
            $preorder->early_bird_pieces -= $taken;
            $over -= $taken;
        }

        // Free early-bird pieces: the earliest preorders still short first.
        $free = $limit - self::given($preorders);

        foreach ($preorders as $preorder) {
            if ($free <= 0) {
                break;
            }

            $given = min($free, $preorder->quantity - $preorder->early_bird_pieces);
            $preorder->early_bird_pieces += $given;
            $free -= $given;
        }

        $preorders->filter(fn (Preorder $preorder): bool => $preorder->isDirty('early_bird_pieces'))
            ->each(fn (Preorder $preorder) => $preorder->save());
    }

    /**
     * Early-bird pieces still free, or null when the product has no
     * early-bird price.
     */
    public static function piecesLeft(Product $product): ?int
    {
        if ($product->early_bird_price_centavos === null || $product->early_bird_pieces === null) {
            return null;
        }

        $taken = (int) Preorder::query()
            ->where('product_id', $product->id)
            ->where('status', PreorderStatus::Active)
            ->sum('early_bird_pieces');

        return max(0, $product->early_bird_pieces - $taken);
    }

    /**
     * @param  Collection<int, Preorder>  $preorders
     */
    private static function given(Collection $preorders): int
    {
        return $preorders->reduce(fn (int $sum, Preorder $preorder): int => $sum + $preorder->early_bird_pieces, 0);
    }

    /**
     * @return Collection<int, Preorder> active preorders, earliest first
     */
    private static function counted(Product $product): Collection
    {
        return Preorder::query()
            ->where('product_id', $product->id)
            ->where('status', PreorderStatus::Active)
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();
    }
}
