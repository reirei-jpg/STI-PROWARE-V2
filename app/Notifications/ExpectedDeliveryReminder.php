<?php

namespace App\Notifications;

use App\Models\PurchaseOrder;
use Illuminate\Notifications\Notification;

/**
 * Reminds the Specialist that Head Office said items of an order will
 * arrive tomorrow or today, with how much of the order has arrived so far.
 */
class ExpectedDeliveryReminder extends Notification
{
    /**
     * @param  'tomorrow'|'today'  $when
     */
    public function __construct(public PurchaseOrder $purchaseOrder, public string $when) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array{kind: string, purchase_order_id: int, order_number: ?string, expected_delivery_date: ?string, when: string, percent_received: int, quantity_remaining: int}
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'delivery_reminder',
            'purchase_order_id' => $this->purchaseOrder->id,
            'order_number' => $this->purchaseOrder->order_number,
            'expected_delivery_date' => $this->purchaseOrder->expected_delivery_date?->toDateString(),
            'when' => $this->when,
            'percent_received' => $this->purchaseOrder->percentReceived(),
            'quantity_remaining' => $this->purchaseOrder->quantityRemaining(),
        ];
    }
}
