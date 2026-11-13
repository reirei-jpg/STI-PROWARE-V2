<?php

namespace App\Notifications;

use App\Models\PreorderSlip;
use App\Models\Product;
use App\Notifications\Channels\PushChannel;
use App\Notifications\Channels\PushesToPhones;
use Illuminate\Notifications\Notification;

/**
 * Tells a buyer with an unpaid preorder the payment dates the Specialist
 * set: pay at the cashier with the preorder slip between them, or the
 * preorder is dropped after the close date. Also pushed to their phones.
 */
class PreorderPayBy extends Notification implements PushesToPhones
{
    public function __construct(public Product $product, public PreorderSlip $slip) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', PushChannel::class];
    }

    /**
     * @return array{kind: string, product_id: int, product_name: string, slip_id: int, number: string|null, amount_centavos: int, pay_from: string|null, pay_until: string|null}
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'preorder_pay_by',
            'product_id' => $this->product->id,
            'product_name' => $this->product->name,
            'slip_id' => $this->slip->id,
            'number' => $this->slip->number,
            'amount_centavos' => $this->slip->amountDue(),
            'pay_from' => $this->product->preorder_pay_from?->toDateString(),
            'pay_until' => $this->product->preorders_close_on?->toDateString(),
        ];
    }

    /**
     * @return array{title: string, body: string, data: array<string, scalar|null>}
     */
    public function toPush(object $notifiable): array
    {
        return [
            'title' => "Pay for your preorder: {$this->product->name}",
            'body' => self::body($this->toArray($notifiable)),
            'data' => ['kind' => 'preorder_pay_by', 'slip_id' => $this->slip->id],
        ];
    }

    /**
     * "Pay ₱200.00 at the cashier with preorder slip PR-0002 between Nov 15
     * and Nov 30, 2026. Preorders not paid by Nov 30 are dropped."
     *
     * @param  array{amount_centavos: int, number: string|null, pay_from: string|null, pay_until: string|null}  $data
     */
    public static function body(array $data): string
    {
        $from = $data['pay_from'] === null ? '' : date('M j', (int) strtotime($data['pay_from']));
        $until = $data['pay_until'] === null ? '' : date('M j, Y', (int) strtotime($data['pay_until']));
        $untilShort = $data['pay_until'] === null ? '' : date('M j', (int) strtotime($data['pay_until']));

        return 'Pay ₱'.number_format($data['amount_centavos'] / 100, 2)." at the cashier with preorder slip {$data['number']} between {$from} and {$until}. Preorders not paid by {$untilShort} are dropped.";
    }
}
