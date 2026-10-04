<?php

namespace App\Notifications;

use App\Models\PurchaseOrder;
use Illuminate\Notifications\Notification;

/**
 * Tells the School Admin that the Specialist closed a purchase order before
 * everything arrived, with the reason, so the shortfall can be traced.
 */
class PurchaseOrderClosedShort extends Notification
{
    public function __construct(public PurchaseOrder $purchaseOrder) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array{kind: string, purchase_order_id: int, order_number: string|null, reason: string|null, closed_by: string|null, percent_received: int}
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'purchase_order_closed_short',
            'purchase_order_id' => $this->purchaseOrder->id,
            'order_number' => $this->purchaseOrder->order_number,
            'reason' => $this->purchaseOrder->closed_reason,
            'closed_by' => $this->purchaseOrder->closer?->name,
            'percent_received' => $this->purchaseOrder->percentReceived(),
        ];
    }
}
