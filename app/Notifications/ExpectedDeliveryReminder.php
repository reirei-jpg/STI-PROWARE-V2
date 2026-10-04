<?php

namespace App\Notifications;

use App\Models\PurchaseOrder;
use App\Notifications\Channels\PushChannel;
use App\Notifications\Channels\PushesToPhones;
use Illuminate\Notifications\Notification;

/**
 * Reminds the Specialist that Head Office said items of an order will
 * arrive tomorrow or today, with how much of the order has arrived so far.
 */
class ExpectedDeliveryReminder extends Notification implements PushesToPhones
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
        return ['database', PushChannel::class];
    }

    /**
     * "Delivery expected today: Order #30722": the same words as the
     * website's bell.
     *
     * @return array{title: string, body: string, data: array<string, scalar|null>}
     */
    public function toPush(object $notifiable): array
    {
        $reminder = $this->toArray($notifiable);
        $date = $this->purchaseOrder->expected_delivery_date?->format('M j, Y');

        return [
            'title' => "Delivery expected {$reminder['when']}".($reminder['order_number'] ? ": Order #{$reminder['order_number']}" : ''),
            'body' => "{$reminder['percent_received']}% received so far · ".number_format($reminder['quantity_remaining']).' still to come (as ordered on the eStore)'.($date ? " · {$date}" : ''),
            'data' => ['kind' => 'delivery_reminder', 'purchase_order_id' => $reminder['purchase_order_id']],
        ];
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
