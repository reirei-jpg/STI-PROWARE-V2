<?php

namespace App\Notifications;

use App\Models\Order;
use App\Notifications\Channels\PushChannel;
use App\Notifications\Channels\PushesToPhones;
use Illuminate\Notifications\Notification;

/**
 * Tells the student their order was released to them at the PROWARE office.
 * Also pushed to their phones.
 */
class OrderReleased extends Notification implements PushesToPhones
{
    public function __construct(public Order $order) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', PushChannel::class];
    }

    /**
     * @return array{kind: string, order_id: int, order_number: string|null, items: string}
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'order_released',
            'order_id' => $this->order->id,
            'order_number' => $this->order->number,
            'items' => $this->order->itemsText(),
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
            'title' => "Released to you: {$this->order->itemsText()}",
            'body' => 'Thank you for your order.',
            'data' => ['kind' => 'order_released', 'order_id' => $this->order->id],
        ];
    }
}
