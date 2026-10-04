<?php

namespace App\Notifications;

use App\Models\Order;
use App\Notifications\Channels\PushChannel;
use App\Notifications\Channels\PushesToPhones;
use Illuminate\Notifications\Notification;

/**
 * Tells the student their order was cancelled (by the PROWARE office, or
 * because it was not picked up in time) and why. Also pushed to their
 * phones.
 */
class OrderCancelled extends Notification implements PushesToPhones
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
     * @return array{kind: string, order_id: int, order_number: string|null, reason: string|null}
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'order_cancelled',
            'order_id' => $this->order->id,
            'order_number' => $this->order->number,
            'reason' => $this->order->cancel_reason,
        ];
    }

    /**
     * @return array{title: string, body: string, data: array<string, scalar|null>}
     */
    public function toPush(object $notifiable): array
    {
        return [
            'title' => "Order {$this->order->number} was cancelled",
            'body' => $this->order->cancel_reason ?? 'Please ask the PROWARE office.',
            'data' => ['kind' => 'order_cancelled', 'order_id' => $this->order->id],
        ];
    }
}
