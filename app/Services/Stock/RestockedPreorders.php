<?php

namespace App\Services\Stock;

use App\Enums\PreorderStatus;
use App\Enums\ProductStatus;
use App\Models\Preorder;
use App\Models\PreorderSlip;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Notifications\PreorderArrived;
use App\Notifications\PreorderReady;
use App\Services\Storefront\StorefrontFeed;
use Illuminate\Support\Facades\DB;

/**
 * Serves the buyers waiting for a size once it has pieces free to sell (a
 * delivery, a recount, a cancelled order): PAID preorders first, first
 * come, first served. Their pieces are set aside (held, no time limit) and
 * the buyer is told they are ready to pick up; the Specialist releases them
 * by scanning the preorder slip. When fewer arrived than a buyer preordered,
 * the arrived pieces are set aside and the rest keeps its place in line.
 * Pieces left over: buyers who did not pay are told it is back in stock, to
 * buy like anyone (nothing is held for them); the rest is free for anyone.
 *
 * A Preorder (Coming Soon) product becomes Available as soon as a size gets
 * stock, so students can order it: it moves to All Merchandise at once. A
 * product's first stock makes it NEW for 3 days. A size marked "will not be
 * restocked" is cleared when stock comes in anyway.
 */ final class RestockedPreorders
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
        $wasComingSoon = $product->status === ProductStatus::Preorder;

        if ($variant->stock_on_hand > 0) {
            $this->arrived($product);
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
        $paid = array_flip(PreorderSlip::query()->whereIn('batch', $waiting->pluck('batch')->unique()->all())->whereNotNull('paid_at')->pluck('batch')->all());

        // Paid preorders first, first come, first served: their pieces are
        // set aside until the Specialist releases them.
        foreach ($waiting as $preorder) {
            if ($free === 0) {
                break;
            }

            if (! isset($paid[$preorder->batch])) {
                continue;
            }

            $free -= $this->setAside($variant, $preorder, min($free, $preorder->quantity));
        }

        // Pieces left over: buyers who did not pay are told it is back, to
        // buy like anyone (nothing is held for them).
        if ($free === 0) {
            return;
        }

        foreach ($waiting as $preorder) {
            if (isset($paid[$preorder->batch]) || $preorder->status !== PreorderStatus::Active) {
                continue;
            }

            $preorder->forceFill(['status' => PreorderStatus::Arrived, 'arrived_at' => now()])->save();
            $preorder->setRelations(['product' => $product, 'variant' => $variant]);
            DB::afterCommit(fn () => $preorder->student->notify(new PreorderArrived($product, $wasComingSoon ? null : $variant)));
        }
    }

    /**
     * Set aside $pieces of the paid preorder for its buyer (held, no time
     * limit) and tell them it is ready to pick up. When fewer arrived than
     * were preordered, the rest keeps its place in line.
     *
     * @return int the pieces set aside
     */
    private function setAside(ProductVariant $variant, Preorder $preorder, int $pieces): int
    {
        $preordered = $preorder->quantity;
        $alreadyHeld = Preorder::query()
            ->where('batch', $preorder->batch)
            ->where('product_variant_id', $variant->id)
            ->where('status', PreorderStatus::Held)
            ->first();

        // More pieces for a preorder that already has some set aside: one line.
        if ($alreadyHeld !== null) {
            $alreadyHeld->forceFill([
                'quantity' => $alreadyHeld->quantity + $pieces,
                'early_bird_pieces' => $alreadyHeld->early_bird_pieces + min($preorder->early_bird_pieces, $pieces),
            ])->save();

            if ($pieces < $preordered) {
                $preorder->forceFill(['quantity' => $preordered - $pieces, 'early_bird_pieces' => max(0, $preorder->early_bird_pieces - $pieces)])->save();
            } else {
                $preorder->delete();
            }

            $this->ready($variant, $alreadyHeld, $pieces);

            return $pieces;
        }

        if ($pieces < $preordered) {
            $this->keepRestWaiting($preorder, $preordered - $pieces);
        }

        $preorder->forceFill([
            'quantity' => $pieces,
            'early_bird_pieces' => min($preorder->early_bird_pieces, $pieces),
            'status' => PreorderStatus::Held,
            'arrived_at' => now(),
            // Paid: kept until it is released, no time limit.
            'held_until' => null,
        ])->save();

        $this->ready($variant, $preorder, $pieces);

        return $pieces;
    }

    /**
     * A Coming Soon product that got stock can be ordered now: Available, in
     * All Merchandise, and NEW. Any other product is NEW when its first stock
     * arrives.
     */
    private function arrived(Product $product): void
    {
        if ($product->status === ProductStatus::Preorder) {
            $product->update(['status' => ProductStatus::Available]);
            $product->forceFill(['new_until' => now()->addDays(StorefrontFeed::NEW_DAYS)])->save();

            return;
        }

        if ($product->new_until === null) {
            $product->forceFill(['new_until' => now()->addDays(StorefrontFeed::NEW_DAYS)])->save();
        }
    }

    /**
     * Count the newly set-aside pieces apart from what is free to sell, and
     * tell the buyer they are ready to pick up (once the change is saved).
     */
    private function ready(ProductVariant $variant, Preorder $hold, int $pieces): void
    {
        $variant->forceFill(['preorder_held_pieces' => $variant->preorder_held_pieces + $pieces])->save();

        $hold->setRelations(['product' => $variant->product, 'variant' => $variant]);
        DB::afterCommit(fn () => $hold->student->notify(new PreorderReady($hold, $pieces)));
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
