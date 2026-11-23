<?php

namespace App\Notifications;

use App\Models\Order;
use App\Models\PreorderSlip;
use App\Notifications\Channels\PushChannel;
use App\Notifications\Channels\PushesToPhones;
use Illuminate\Notifications\Notification;

/**
 * Tells the Specialist an order or preorder slip has been paid: a paid order
 * is ready for release, a paid preorder slip is released once its items
 * arrive. Only that it is paid: the cashier's record (receipt, method,
 * reference, who received it) stays with the cashier. Also pushed to their
 * phones.
 */
class PaymentRecorded extends Notification implements PushesToPhones
{
    public function __construct(public Order|PreorderSlip $paid) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', PushChannel::class];
    }

    /**
     * @return array{kind: string, order_id: int|null, preorder_slip_id: int|null, number: string|null, buyer_name: string, amount_centavos: int}
     */
    public function toArray(object $notifiable): array
    {
        $isOrder = $this->paid instanceof Order;

        return [
            'kind' => 'payment_recorded',
            'order_id' => $isOrder ? $this->paid->id : null,
            'preorder_slip_id' => $isOrder ? null : $this->paid->id,
            'number' => $this->paid->number,
            'buyer_name' => $this->paid->student->name,
            'amount_centavos' => $isOrder ? $this->paid->total_centavos : (int) $this->paid->paid_centavos,
        ];
    }

    /**
     * "Paid: PW-0042 · Juan Dela Cruz", in the bell's words.
     *
     * @return array{title: string, body: string, data: array<string, scalar|null>}
     */
    public function toPush(object $notifiable): array
    {
        $data = $this->toArray($notifiable);

        return [
            'title' => "Paid: {$data['number']} · {$data['buyer_name']}",
            'body' => self::body($data),
            'data' => ['kind' => 'payment_recorded', 'order_id' => $data['order_id'], 'preorder_slip_id' => $data['preorder_slip_id'], 'number' => $data['number']],
        ];
    }

    /**
     * "₱100.00 paid. Ready for release."
     *
     * @param  array{order_id: int|null, amount_centavos: int}  $data
     */
    public static function body(array $data): string
    {
        return '₱'.number_format($data['amount_centavos'] / 100, 2).' paid. '
            .($data['order_id'] !== null ? 'Ready for release.' : 'The items are released once they arrive.');
    }
}
