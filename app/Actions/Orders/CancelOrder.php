<?php

namespace App\Actions\Orders;

use App\Enums\OrderStatus;
use App\Enums\StockMovementType;
use App\Models\Order;
use App\Models\ProductVariant;
use App\Models\User;
use App\Notifications\OrderCancelled;
use App\Services\Stock\LowStockAlerts;
use Illuminate\Support\Facades\DB;

/**
 * Cancels an order that was not picked up yet: its pieces go back to stock
 * (recorded as "Order cancelled · PW-0001"). When the student did not
 * cancel it themselves, they are told why.
 */
class CancelOrder
{
    public function __construct(private LowStockAlerts $lowStockAlerts) {}

    /**
     * @param  User|null  $cancelledBy  null when it cancels itself (not picked up in time)
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
                $balance = $variant->stock_on_hand + $item->pieces();
                $variant->forceFill(['stock_on_hand' => $balance])->save();

                $variant->stockMovements()->create([
                    'type' => StockMovementType::OrderCancelled,
                    'quantity' => $item->pieces(),
                    'balance_after' => $balance,
                    'order_item_id' => $item->id,
                    'units_received' => $item->quantity,
                    'unit_name' => $item->unit_name,
                    'pieces_per_unit' => $item->pieces_per_unit,
                    'recorded_by' => $cancelledBy?->id,
                ]);

                $this->lowStockAlerts->check($variant);
            }

            $order->forceFill([
                'status' => OrderStatus::Cancelled,
                'cancelled_at' => now(),
                'cancel_reason' => $reason,
                'handled_by' => $cancelledBy?->isStudent() ? null : $cancelledBy?->id,
            ])->save();

            if ($cancelledBy?->id !== $order->user_id) {
                $order->student->notify(new OrderCancelled($order));
            }
        });
    }
}
