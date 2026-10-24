<?php

namespace App\Notifications;

use App\Models\Delivery;
use App\Models\PurchaseOrder;
use Illuminate\Notifications\Notification;

/**
 * Tells the School Admin that everything an eStore order asked for has
 * arrived: the delivery that brought the last pieces completed it.
 */
class PurchaseOrderCompleted extends Notification
{
    public function __construct(public PurchaseOrder $purchaseOrder, public Delivery $delivery) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array{kind: string, purchase_order_id: int, order_number: string|null, date_ordered: string, completed_at: string|null, completed_after_days: int, quantity_received: int, recorded_by: string}
     */
    public function toArray(object $notifiable): array
    {
        $completedAt = $this->delivery->created_at;

        return [
            'kind' => 'purchase_order_completed',
            'purchase_order_id' => $this->purchaseOrder->id,
            'order_number' => $this->purchaseOrder->order_number,
            'date_ordered' => $this->purchaseOrder->date_ordered->toDateString(),
            'completed_at' => $completedAt?->toIso8601String(),
            'completed_after_days' => $completedAt === null ? 0 : (int) $this->purchaseOrder->date_ordered->copy()->startOfDay()->diffInDays($completedAt->copy()->startOfDay()),
            'quantity_received' => $this->purchaseOrder->quantity_received_total,
            'recorded_by' => $this->delivery->recorder->name,
        ];
    }
}
