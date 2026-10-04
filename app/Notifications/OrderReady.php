<?php

namespace App\Notifications;

use App\Models\Order;
use App\Notifications\Channels\PushChannel;
use App\Notifications\Channels\PushesToPhones;
use Illuminate\Notifications\Notification;

/**
 * Tells the student their order is ready at the PROWARE office, and the
 * last day to pick it up and pay in cash. Also pushed to their phones.
 */
class OrderReady extends Notification implements PushesToPhones
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
            'kind' => 'order_ready',
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
            'title' => "Order {$this->order->number} is ready for pickup",
            'body' => 'Pick it up at the PROWARE office and pay ₱'.number_format($this->order->total_centavos / 100, 2)." in cash by {$this->order->pick_up_by->format('M j, Y')}.",
            'data' => ['kind' => 'order_ready', 'order_id' => $this->order->id],
        ];
    }
}
