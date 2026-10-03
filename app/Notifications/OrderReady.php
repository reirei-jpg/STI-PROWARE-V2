<?php

namespace App\Notifications;

use App\Models\Order;
use Illuminate\Notifications\Notification;

/**
 * Tells the student their order is ready at the PROWARE office, and the
 * last day to pick it up and pay in cash.
 */
class OrderReady extends Notification
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
     * @return array{kind: string, order_id: int, order_number: string|null, total_centavos: int, pick_up_by: string}
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'order_ready',
            'order_id' => $this->order->id,
            'order_number' => $this->order->number,
            'total_centavos' => $this->order->total_centavos,
            'pick_up_by' => $this->order->pick_up_by->toDateString(),
        ];
    }
}
