<?php

namespace App\Notifications;

use App\Models\Order;
use App\Notifications\Channels\PushChannel;
use App\Notifications\Channels\PushesToPhones;
use Illuminate\Notifications\Notification;

/**
 * Tells the Specialist a student placed an order, so it can be prepared
 * for pickup.
 */
class OrderPlaced extends Notification implements PushesToPhones
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
     * "New order PW-0001": the same words as the website's bell.
     *
     * @return array{title: string, body: string, data: array<string, scalar|null>}
     */
    public function toPush(object $notifiable): array
    {
        $order = $this->toArray($notifiable);
        $items = $order['items_count'] === 1 ? 'item' : 'items';

        return [
            'title' => "New order {$order['order_number']}",
            'body' => "{$order['student_name']} · {$order['items_count']} {$items} · ₱".number_format($order['total_centavos'] / 100, 2).' to pay in cash. Prepare it, then mark it Ready for pickup.',
            'data' => ['kind' => 'order_placed', 'order_id' => $order['order_id']],
        ];
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
