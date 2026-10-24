<?php

namespace App\Notifications;

use App\Models\PurchaseOrder;
use App\Models\User;
use App\Notifications\Channels\PushChannel;
use App\Notifications\Channels\PushesToPhones;
use App\Services\Deliveries\FollowUp;
use Illuminate\Notifications\Notification;

/**
 * The School Admin's ready-made reminder to the Specialist about a late
 * eStore order: it is not complete after the follow-up days, so why is it
 * not delivered yet? Also pushed to the Specialist's phones.
 */
class PurchaseOrderReminder extends Notification implements PushesToPhones
{
    public function __construct(public PurchaseOrder $purchaseOrder, public User $schoolAdmin) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', PushChannel::class];
    }

    /**
     * @return array{kind: string, purchase_order_id: int, order_number: string|null, date_ordered: string, days_since_ordered: int, late_days: int, quantity_remaining: int, quantity_ordered: int, reminded_by: string}
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'purchase_order_reminder',
            'purchase_order_id' => $this->purchaseOrder->id,
            'order_number' => $this->purchaseOrder->order_number,
            'date_ordered' => $this->purchaseOrder->date_ordered->toDateString(),
            'days_since_ordered' => FollowUp::daysSinceOrdered($this->purchaseOrder),
            'late_days' => FollowUp::days(),
            'quantity_remaining' => $this->purchaseOrder->quantityRemaining(),
            'quantity_ordered' => $this->purchaseOrder->quantity_ordered_total,
            'reminded_by' => $this->schoolAdmin->name,
        ];
    }

    /**
     * @return array{title: string, body: string, data: array<string, scalar|null>}
     */
    public function toPush(object $notifiable): array
    {
        $order = $this->purchaseOrder->order_number === null ? 'An eStore order' : "Order #{$this->purchaseOrder->order_number}";

        return [
            'title' => 'Reminder from the School Admin',
            'body' => "{$order} is not complete after ".FollowUp::days()." days: {$this->purchaseOrder->quantityRemaining()} of {$this->purchaseOrder->quantity_ordered_total} still to come. Why is it not delivered yet? Ask Head Office and record the delivery when it arrives.",
            'data' => ['kind' => 'purchase_order_reminder', 'purchase_order_id' => $this->purchaseOrder->id],
        ];
    }
}
