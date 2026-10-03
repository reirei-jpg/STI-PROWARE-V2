<?php

namespace App\Notifications;

use App\Models\Order;
use Illuminate\Notifications\Notification;

/**
 * Tells the student their order was cancelled (by the PROWARE office, or
 * because it was not picked up in time) and why.
 */
class OrderCancelled extends Notification
{
    public function __construct(public Order $order) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
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
}
