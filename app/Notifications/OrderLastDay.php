<?php

namespace App\Notifications;

use App\Models\Order;
use App\Notifications\Channels\PushChannel;
use App\Notifications\Channels\PushesToPhones;
use Illuminate\Notifications\Notification;

/**
 * Reminds the student that today is the last day to get their order at the
 * PROWARE office; after today it expires and its items are free to sell
 * again. Also pushed to their phones.
 */
class OrderLastDay extends Notification implements PushesToPhones
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
     * @return array{kind: string, order_id: int, order_number: string|null, total_centavos: int, pick_up_by: string}
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'order_last_day',
            'order_id' => $this->order->id,
            'order_number' => $this->order->number,
            'total_centavos' => $this->order->total_centavos,
            'pick_up_by' => $this->order->pick_up_by->toDateString(),
        ];
    }

    /**
     * @return array{title: string, body: string, data: array<string, scalar|null>}
     */
    public function toPush(object $notifiable): array
    {
        return [
            'title' => "Last day to get order {$this->order->number}",
            'body' => 'Show its issuance slip at the PROWARE office today. After today it expires and the items go back on sale.',
            'data' => ['kind' => 'order_last_day', 'order_id' => $this->order->id],
        ];
    }
}
