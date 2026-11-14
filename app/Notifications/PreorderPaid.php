<?php

namespace App\Notifications;

use App\Models\PreorderSlip;
use App\Notifications\Channels\PushChannel;
use App\Notifications\Channels\PushesToPhones;
use Illuminate\Notifications\Notification;

/**
 * Tells the buyer their payment for a preorder was recorded: the slip now
 * says PAID and is their proof of payment. Also pushed to their phones.
 */
class PreorderPaid extends Notification implements PushesToPhones
{
    public function __construct(public PreorderSlip $slip) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', PushChannel::class];
    }

    /**
     * @return array{kind: string, slip_id: int, number: string|null, product_id: int, product_name: string, paid_centavos: int|null}
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'preorder_paid',
            'slip_id' => $this->slip->id,
            'number' => $this->slip->number,
            'product_id' => $this->slip->product_id,
            'product_name' => $this->slip->product->name,
            'paid_centavos' => $this->slip->paid_centavos,
        ];
    }

    /**
     * @return array{title: string, body: string, data: array<string, scalar|null>}
     */
    public function toPush(object $notifiable): array
    {
        return [
            'title' => "Preorder paid: {$this->slip->product->name}",
            'body' => self::body($this->slip->paid_centavos),
            'data' => ['kind' => 'preorder_paid', 'slip_id' => $this->slip->id],
        ];
    }

    /**
     * "₱960.00 paid. Keep your preorder slip as proof of payment."
     */
    public static function body(?int $paidCentavos): string
    {
        return '₱'.number_format((int) $paidCentavos / 100, 2).' paid. Keep your preorder slip as proof of payment.';
    }
}
