<?php

namespace App\Notifications;

use App\Models\Order;
use App\Notifications\Channels\PushChannel;
use App\Notifications\Channels\PushesToPhones;
use Illuminate\Notifications\Notification;

/**
 * Tells the student their order was released to them at the PROWARE office,
 * naming what they got and what was sold out before they paid (short).
 * Also pushed to their phones.
 */
class OrderReleased extends Notification implements PushesToPhones
{
    /**
     * @param  list<string>  $short  e.g. ["2 pcs of STI Lanyard (Blue)"]
     */
    public function __construct(public Order $order, public array $short = []) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', PushChannel::class];
    }

    /**
     * @return array{kind: string, order_id: int, order_number: string|null, items: string, short: string|null}
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'order_released',
            'order_id' => $this->order->id,
            'order_number' => $this->order->number,
            'items' => $this->order->itemsText(handedOver: true),
            'short' => $this->short === [] ? null : implode(', ', $this->short),
        ];
    }

    /**
     * "Released to you: STI Lanyard (Blue)": item names, not the PW- number.
     *
     * @return array{title: string, body: string, data: array<string, scalar|null>}
     */
    public function toPush(object $notifiable): array
    {
        return [
            'title' => "Released to you: {$this->order->itemsText(handedOver: true)}",
            'body' => $this->short === [] ? 'Thank you for your order.' : 'Not charged (sold out before your payment): '.implode(', ', $this->short).'.',
            'data' => ['kind' => 'order_released', 'order_id' => $this->order->id],
        ];
    }
}
