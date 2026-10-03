<?php

namespace App\Notifications;

use App\Models\Order;
use Illuminate\Notifications\Notification;

/**
 * Tells the Specialist a student placed an order, so it can be prepared
 * for pickup.
 */
class OrderPlaced extends Notification
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
     * @return array{kind: string, order_id: int, order_number: string|null, student_name: string, total_centavos: int, items_count: int}
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'order_placed',
            'order_id' => $this->order->id,
            'order_number' => $this->order->number,
            'student_name' => $this->order->student->name,
            'total_centavos' => $this->order->total_centavos,
            'items_count' => $this->order->items()->count(),
        ];
    }
}
