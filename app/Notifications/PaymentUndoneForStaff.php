<?php

namespace App\Notifications;

use App\Models\Order;
use App\Models\PreorderSlip;
use App\Notifications\Channels\PushChannel;
use App\Notifications\Channels\PushesToPhones;
use Illuminate\Notifications\Notification;

/**
 * Tells the Specialist that an order or preorder slip they were told was
 * paid is waiting for payment again, so it is not released. Nothing of the
 * cashier's record (reason, receipt, who undid it). Also pushed to their
 * phones.
 */
class PaymentUndoneForStaff extends Notification implements PushesToPhones
{
    public function __construct(public Order|PreorderSlip $unpaid) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', PushChannel::class];
    }

    /**
     * @return array{kind: string, order_id: int|null, preorder_slip_id: int|null, number: string|null, buyer_name: string}
     */
    public function toArray(object $notifiable): array
    {
        $isOrder = $this->unpaid instanceof Order;

        return [
            'kind' => 'payment_undone_staff',
            'order_id' => $isOrder ? $this->unpaid->id : null,
            'preorder_slip_id' => $isOrder ? null : $this->unpaid->id,
            'number' => $this->unpaid->number,
            'buyer_name' => $this->unpaid->student->name,
        ];
    }

    /**
     * "Awaiting payment again: PW-0042 · Juan Dela Cruz".
     *
     * @return array{title: string, body: string, data: array<string, scalar|null>}
     */
    public function toPush(object $notifiable): array
    {
        $data = $this->toArray($notifiable);

        return [
            'title' => "Awaiting payment again: {$data['number']} · {$data['buyer_name']}",
            'body' => self::body(),
            'data' => ['kind' => 'payment_undone_staff', 'order_id' => $data['order_id'], 'preorder_slip_id' => $data['preorder_slip_id'], 'number' => $data['number']],
        ];
    }

    public static function body(): string
    {
        return 'Its payment was undone at the cashier. Release it only once it is paid.';
    }
}
