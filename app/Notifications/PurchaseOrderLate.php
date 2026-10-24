<?php

namespace App\Notifications;

use App\Models\PurchaseOrder;
use App\Services\Deliveries\FollowUp;
use Illuminate\Notifications\Notification;

/**
 * Tells the School Admin that an eStore order is still not complete after
 * the days set in Maintenance (Head Office gives no delivery date), once
 * per order.
 */
class PurchaseOrderLate extends Notification
{
    public function __construct(public PurchaseOrder $purchaseOrder, public int $lateDays) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array{kind: string, purchase_order_id: int, order_number: string|null, date_ordered: string, days_since_ordered: int, late_days: int, quantity_received: int, quantity_ordered: int, percent_received: int}
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'purchase_order_late',
            'purchase_order_id' => $this->purchaseOrder->id,
            'order_number' => $this->purchaseOrder->order_number,
            'date_ordered' => $this->purchaseOrder->date_ordered->toDateString(),
            'days_since_ordered' => FollowUp::daysSinceOrdered($this->purchaseOrder),
            'late_days' => $this->lateDays,
            'quantity_received' => $this->purchaseOrder->quantity_received_total,
            'quantity_ordered' => $this->purchaseOrder->quantity_ordered_total,
            'percent_received' => $this->purchaseOrder->percentReceived(),
        ];
    }
}
