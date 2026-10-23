<?php

namespace App\Notifications;

use App\Models\Order;
use App\Notifications\Channels\PushChannel;
use App\Notifications\Channels\PushesToPhones;
use Illuminate\Notifications\Notification;

/**
 * Tells the Specialist a student cancelled their own order, and why, so
 * they stop preparing it. Also pushed to their phones.
 */
class OrderCancelledByStudent extends Notification implements PushesToPhones
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
     * @return array{kind: string, order_id: int, order_number: string|null, student_name: string, reason: string|null}
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'order_cancelled_by_student',
            'order_id' => $this->order->id,
            'order_number' => $this->order->number,
            'student_name' => $this->order->student->name,
            'reason' => $this->order->cancel_reason,
        ];
    }

    /**
     * @return array{title: string, body: string, data: array<string, scalar|null>}
     */
    public function toPush(object $notifiable): array
    {
        return [
            'title' => "Order {$this->order->number} was cancelled by the student",
            'body' => "{$this->order->student->name}: ".($this->order->cancel_reason ?? 'No reason given.').' Its items are free to sell again.',
            'data' => ['kind' => 'order_cancelled_by_student', 'order_id' => $this->order->id],
        ];
    }
}
