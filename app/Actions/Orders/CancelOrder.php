<?php

namespace App\Actions\Orders;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\ProductVariant;
use App\Models\User;
use App\Notifications\OrderCancelled;
use App\Services\Stock\LowStockAlerts;
use App\Services\Stock\RestockedPreorders;
use Illuminate\Support\Facades\DB;

/**
 * Cancels an order that was not released yet. Orders do not hold stock,
 * except an order of an arrived preorder's pieces: those pieces are free to
 * sell again, and buyers waiting for a sold-out size get notified. When the
 * buyer did not cancel it themselves, they are told why.
 */
class CancelOrder
{
    public function __construct(
        private LowStockAlerts $lowStockAlerts,
        private RestockedPreorders $restockedPreorders,
    ) {}

    public function handle(Order $order, User $cancelledBy, string $reason): void
    {
        DB::transaction(function () use ($order, $cancelledBy, $reason): void {
            $order = Order::query()->with('items')->lockForUpdate()->findOrFail($order->id);

            if (! $order->status->isOpen()) {
                return;
            }

            if ($order->holdsItems()) {
                foreach ($order->items as $item) {
                    $variant = ProductVariant::query()->with('product')->lockForUpdate()->findOrFail($item->product_variant_id);
                    $variant->forceFill(['held_pieces' => max(0, $variant->held_pieces - $item->pieces())])->save();

                    $this->lowStockAlerts->check($variant);
                    $this->restockedPreorders->check($variant);
                }
            }

            $order->forceFill([
                'status' => OrderStatus::Cancelled,
                'cancelled_at' => now(),
                'cancel_reason' => $reason,
                'handled_by' => $cancelledBy->isBuyer() ? null : $cancelledBy->id,
            ])->save();

            if ($cancelledBy->id !== $order->user_id) {
                $order->student->notify(new OrderCancelled($order));
            }
        });
    }
}
