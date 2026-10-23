<?php

namespace App\Actions\Orders;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\ProductVariant;
use App\Models\User;
use App\Notifications\OrderCancelled;
use App\Notifications\OrderingPaused;
use App\Services\Shop\OrderRules;
use App\Services\Stock\LowStockAlerts;
use App\Services\Stock\RestockedPreorders;
use Illuminate\Support\Facades\DB;

/**
 * Cancels an order that was not released yet: its hold ends, so its pieces
 * (which never left the shelf) are free to sell again, and students waiting
 * for a sold-out size get notified. When it cancels itself for not being
 * released in time, it is marked expired (this counts towards the no-show
 * pause in OrderRules; when it pauses the student, they are told until
 * when). When the student did not cancel it themselves, they are told why.
 */
class CancelOrder
{
    public function __construct(
        private LowStockAlerts $lowStockAlerts,
        private RestockedPreorders $restockedPreorders,
    ) {}

    /**
     * @param  User|null  $cancelledBy  null when it expired (not released in time)
     */
    public function handle(Order $order, ?User $cancelledBy, string $reason): void
    {
        DB::transaction(function () use ($order, $cancelledBy, $reason): void {
            $order = Order::query()->with('items')->lockForUpdate()->findOrFail($order->id);

            if (! $order->status->isOpen()) {
                return;
            }

            foreach ($order->items as $item) {
                $variant = ProductVariant::query()->with('product')->lockForUpdate()->findOrFail($item->product_variant_id);
                $variant->forceFill(['held_pieces' => max(0, $variant->held_pieces - $item->pieces())])->save();

                $this->lowStockAlerts->check($variant);
                $this->restockedPreorders->check($variant);
            }

            $order->forceFill([
                'status' => OrderStatus::Cancelled,
                'cancelled_at' => now(),
                'expired_at' => $cancelledBy === null ? now() : null,
                'cancel_reason' => $reason,
                'handled_by' => $cancelledBy?->isStudent() ? null : $cancelledBy?->id,
            ])->save();

            if ($cancelledBy?->id !== $order->user_id) {
                $order->student->notify(new OrderCancelled($order));
            }

            // An expiry that pauses the student's ordering: they are told until when.
            if ($cancelledBy === null) {
                $student = $order->student;
                DB::afterCommit(function () use ($student): void {
                    $pausedUntil = OrderRules::pausedUntil($student);

                    if ($pausedUntil !== null) {
                        $student->notify(new OrderingPaused($pausedUntil));
                    }
                });
            }
        });
    }
}
