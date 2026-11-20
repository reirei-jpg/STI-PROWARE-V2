<?php

namespace App\Notifications;

use App\Models\Order;
use App\Models\PreorderSlip;
use App\Notifications\Channels\PushChannel;
use App\Notifications\Channels\PushesToPhones;
use Illuminate\Notifications\Notification;

/**
 * Tells the buyer the cashier undid a payment recorded by mistake, with the
 * reason: the order or preorder is waiting for payment again. Names the
 * items, not the PW-/PR- number. Also pushed to their phones.
 */
class PaymentUndone extends Notification implements PushesToPhones
{
    public function __construct(public Order|PreorderSlip $undone, public int $amountCentavos, public string $reason) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', PushChannel::class];
    }

    /**
     * @return array{kind: string, order_id: int|null, slip_id: int|null, items: string, amount_centavos: int, reason: string}
     */
    public function toArray(object $notifiable): array
    {
        $isOrder = $this->undone instanceof Order;

        return [
            'kind' => 'payment_undone',
            'order_id' => $isOrder ? $this->undone->id : null,
            'slip_id' => $isOrder ? null : $this->undone->id,
            'items' => $isOrder ? $this->undone->itemsText() : $this->undone->product->name,
            'amount_centavos' => $this->amountCentavos,
            'reason' => $this->reason,
        ];
    }

    /**
     * "Payment undone: STI Lanyard (Blue)".
     *
     * @return array{title: string, body: string, data: array<string, scalar|null>}
     */
    public function toPush(object $notifiable): array
    {
        $data = $this->toArray($notifiable);

        return [
            'title' => "Payment undone: {$data['items']}",
            'body' => self::body($data),
            'data' => ['kind' => 'payment_undone', 'order_id' => $data['order_id'], 'slip_id' => $data['slip_id']],
        ];
    }

    /**
     * "The cashier undid your ₱100.00 payment: Scanned the wrong slip. Pay at the cashier again to claim your items."
     *
     * @param  array{order_id: int|null, amount_centavos: int, reason: string}  $data
     */
    public static function body(array $data): string
    {
        return 'The cashier undid your ₱'.number_format($data['amount_centavos'] / 100, 2)." payment: {$data['reason']} "
            .($data['order_id'] !== null
                ? 'Pay at the cashier again to claim your items.'
                : 'Pay at the cashier again with your preorder slip.');
    }
}
