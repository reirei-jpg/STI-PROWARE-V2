<?php

namespace App\Services\Stock;

use App\Enums\PreorderStatus;
use App\Enums\ProductStatus;
use App\Models\Preorder;
use App\Models\ProductVariant;
use App\Notifications\PreorderHeld;
use Illuminate\Support\Facades\DB;

/**
 * Serves the students waiting for a size once it has pieces free to sell (a
 * delivery, a recount, a cancelled order, a hold that ended): first come,
 * first served, each preorder's pieces are HELD for that student for 24
 * hours and they are notified. When fewer arrived than a student preordered,
 * the arrived pieces are held and the rest keeps its place in line (a new
 * preorder with the same time). Pieces left after everyone waiting is
 * served are free for anyone to buy.
 *
 * A Preorder (Coming Soon) product becomes Available as soon as a size gets
 * stock, so students can order it. A size marked "will not be restocked" is
 * cleared when stock comes in anyway.
 */
final class RestockedPreorders
{
    /** How long arrived pieces are held for the student. */
    public const HOLD_HOURS = 24;

    /**
     * Run after a variant's stock changed (inside the change's transaction).
     * The notices are sent once the change is saved.
     */
    public function check(ProductVariant $variant): void
    {
        DB::transaction(function () use ($variant): void {
            $locked = ProductVariant::query()->with('product')->lockForUpdate()->find($variant->id);

            if ($locked !== null) {
                $this->serve($locked);
                $variant->setRawAttributes($locked->getAttributes(), true);
            }
        });
    }

    private function serve(ProductVariant $variant): void
    {
        $product = $variant->product;

        if ($product->status === ProductStatus::Preorder && $variant->stock_on_hand > 0) {
            $product->update(['status' => ProductStatus::Available]);
        }

        if (! LowStockAlerts::isSold($product)) {
            return;
        }

        $free = $variant->freeToSell();

        if ($free === 0) {
            return;
        }

        if ($variant->not_restocked_at !== null) {
            $variant->forceFill(['not_restocked_at' => null])->save();
        }

        $waiting = Preorder::query()
            ->where('product_variant_id', $variant->id)
            ->where('status', PreorderStatus::Active)
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();

        foreach ($waiting as $preorder) {
            if ($free === 0) {
                break;
            }

            $preordered = $preorder->quantity;
            $held = min($free, $preordered);
            $alreadyHeld = Preorder::query()
                ->where('user_id', $preorder->user_id)
                ->where('product_variant_id', $variant->id)
                ->where('status', PreorderStatus::Held)
                ->first();

            // More pieces for a student who already has some held: one hold,
            // with 24 hours from now for all of it.
            if ($alreadyHeld !== null) {
                $alreadyHeld->forceFill([
                    'quantity' => $alreadyHeld->quantity + $held,
                    'early_bird_pieces' => $alreadyHeld->early_bird_pieces + min($preorder->early_bird_pieces, $held),
                    'held_until' => now()->addHours(self::HOLD_HOURS),
                ])->save();

                if ($held < $preordered) {
                    $preorder->forceFill(['quantity' => $preordered - $held, 'early_bird_pieces' => max(0, $preorder->early_bird_pieces - $held)])->save();
                } else {
                    $preorder->delete();
                }

                $this->held($variant, $alreadyHeld, $held, $alreadyHeld->quantity + $preordered - $held);
                $free -= $held;

                continue;
            }

            if ($held < $preordered) {
                $this->keepRestWaiting($preorder, $preordered - $held);
            }

            $preorder->forceFill([
                'quantity' => $held,
                'early_bird_pieces' => min($preorder->early_bird_pieces, $held),
                'status' => PreorderStatus::Held,
                'arrived_at' => now(),
                'held_until' => now()->addHours(self::HOLD_HOURS),
            ])->save();

            $this->held($variant, $preorder, $held, $preordered);
            $free -= $held;
        }
    }

    /**
     * Count the newly held pieces apart from what is free to sell, and tell
     * the student (once the change is saved).
     *
     * @param  int  $preordered  the held pieces and those still waiting
     */
    private function held(ProductVariant $variant, Preorder $hold, int $pieces, int $preordered): void
    {
        $variant->forceFill(['preorder_held_pieces' => $variant->preorder_held_pieces + $pieces])->save();

        $hold->setRelations(['product' => $variant->product, 'variant' => $variant]);
        DB::afterCommit(fn () => $hold->student->notify(new PreorderHeld($hold, $preordered)));
    }

    /**
     * The pieces that did not arrive stay waiting, in the same place in line,
     * with the early-bird pieces the arrived ones did not use.
     */
    private function keepRestWaiting(Preorder $preorder, int $rest): void
    {
        $waiting = $preorder->replicate();
        $waiting->quantity = $rest;
        $waiting->early_bird_pieces = max(0, $preorder->early_bird_pieces - $preorder->quantity + $rest);
        $waiting->created_at = $preorder->created_at;
        $waiting->save();
    }
}
