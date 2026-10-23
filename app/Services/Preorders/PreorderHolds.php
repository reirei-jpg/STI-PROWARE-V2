<?php

namespace App\Services\Preorders;

use App\Enums\PreorderStatus;
use App\Models\Preorder;
use App\Models\ProductVariant;
use App\Notifications\PreorderHoldEnded;
use App\Services\Stock\LowStockAlerts;
use App\Services\Stock\RestockedPreorders;
use Illuminate\Support\Facades\DB;

/**
 * Ends holds on arrived preorders: when the student's 24 hours are up
 * without an order (they are notified), or when they cancel it. The pieces
 * go to the next student waiting, or on sale to everyone.
 */
final class PreorderHolds
{
    public function __construct(
        private RestockedPreorders $restockedPreorders,
        private LowStockAlerts $lowStockAlerts,
    ) {}

    /**
     * End every hold whose 24 hours are up (run every minute).
     *
     * @return int holds ended
     */
    public function endExpired(): int
    {
        $ended = 0;

        Preorder::query()
            ->where('status', PreorderStatus::Held)
            ->where('held_until', '<=', now())
            ->orderBy('held_until')
            ->each(function (Preorder $preorder) use (&$ended): void {
                if ($this->end($preorder, PreorderStatus::HoldEnded)) {
                    $ended++;
                }
            });

        return $ended;
    }

    /**
     * End one hold: the preorder becomes $status (Hold ended, or Cancelled
     * by the student) and its pieces are freed for the next student.
     *
     * @return bool false when it was no longer held
     */
    public function end(Preorder $preorder, PreorderStatus $status): bool
    {
        return DB::transaction(function () use ($preorder, $status): bool {
            $preorder = Preorder::query()->lockForUpdate()->find($preorder->id);

            if ($preorder === null || $preorder->status !== PreorderStatus::Held) {
                return false;
            }

            $variant = ProductVariant::query()->with('product')->lockForUpdate()->findOrFail($preorder->product_variant_id);
            $variant->forceFill(['preorder_held_pieces' => max(0, $variant->preorder_held_pieces - $preorder->quantity)])->save();

            $preorder->forceFill(self::closed($status))->save();
            $restClosed = self::closeWaitingRest($preorder, $status);

            if ($status === PreorderStatus::HoldEnded) {
                $preorder->setRelations(['product' => $variant->product, 'variant' => $variant]);
                DB::afterCommit(fn () => $preorder->student->notify(new PreorderHoldEnded($preorder, $restClosed)));
            }

            $this->restockedPreorders->check($variant);
            $this->lowStockAlerts->check($variant);

            return true;
        });
    }

    /**
     * When a student gives up held pieces, lets their 24 hours pass, or
     * orders fewer than were held, the rest of their preorder for that size
     * (still waiting after a partial arrival) closes with it, so the freed
     * pieces go to the next student, not back to them. Its early-bird pieces
     * move to the next preorders in line.
     *
     * @return int the waiting pieces closed
     */
    public static function closeWaitingRest(Preorder $preorder, PreorderStatus $status): int
    {
        $waiting = Preorder::query()
            ->where('user_id', $preorder->user_id)
            ->where('product_variant_id', $preorder->product_variant_id)
            ->where('status', PreorderStatus::Active)
            ->lockForUpdate()
            ->get();

        foreach ($waiting as $rest) {
            $rest->forceFill(self::closed($status))->save();
        }

        if ($waiting->isNotEmpty()) {
            EarlyBird::reallocate($preorder->product()->firstOrFail());
        }

        return (int) $waiting->sum('quantity');
    }

    /**
     * @return array<string, mixed>
     */
    private static function closed(PreorderStatus $status): array
    {
        return $status === PreorderStatus::Cancelled
            ? ['status' => $status, 'cancelled_at' => now()]
            : ['status' => $status, 'hold_ended_at' => now()];
    }
}
