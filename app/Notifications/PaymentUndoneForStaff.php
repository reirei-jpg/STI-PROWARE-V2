<?php

namespace App\Notifications;

use App\Models\UndonePayment;
use App\Notifications\Channels\PushChannel;
use App\Notifications\Channels\PushesToPhones;
use Illuminate\Notifications\Notification;

/**
 * Tells the Specialist the cashier undid a payment recorded by mistake, with
 * the reason, so a paid order they were told about is not released: it is
 * waiting for payment again. Also pushed to their phones.
 */
class PaymentUndoneForStaff extends Notification implements PushesToPhones
{
    public function __construct(public UndonePayment $undone) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', PushChannel::class];
    }

    /**
     * @return array{kind: string, order_id: int|null, preorder_slip_id: int|null, number: string|null, buyer_name: string, amount_centavos: int, reason: string, undone_by: string|null}
     */
    public function toArray(object $notifiable): array
    {
        $paid = $this->undone->order ?? $this->undone->preorderSlip;

        return [
            'kind' => 'payment_undone_staff',
            'order_id' => $this->undone->order_id,
            'preorder_slip_id' => $this->undone->preorder_slip_id,
            'number' => $paid?->number,
            'buyer_name' => (string) $paid?->student->name,
            'amount_centavos' => $this->undone->amount_centavos,
            'reason' => $this->undone->reason,
            'undone_by' => $this->undone->undoer?->name,
        ];
    }

    /**
     * "Payment undone: PW-0042 · Juan Dela Cruz".
     *
     * @return array{title: string, body: string, data: array<string, scalar|null>}
     */
    public function toPush(object $notifiable): array
    {
        $data = $this->toArray($notifiable);

        return [
            'title' => "Payment undone: {$data['number']} · {$data['buyer_name']}",
            'body' => self::body($data),
            'data' => ['kind' => 'payment_undone_staff', 'order_id' => $data['order_id'], 'preorder_slip_id' => $data['preorder_slip_id'], 'number' => $data['number']],
        ];
    }

    /**
     * "₱100.00, undone by Cashier 1: Scanned the wrong slip. It is waiting for payment again."
     *
     * @param  array{amount_centavos: int, reason: string, undone_by: string|null}  $data
     */
    public static function body(array $data): string
    {
        return '₱'.number_format($data['amount_centavos'] / 100, 2)
            .($data['undone_by'] ? ", undone by {$data['undone_by']}" : ' undone')
            .": {$data['reason']} It is waiting for payment again.";
    }
}
