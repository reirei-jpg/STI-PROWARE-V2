<?php

namespace App\Notifications;

use App\Models\Order;
use App\Notifications\Channels\PushChannel;
use App\Notifications\Channels\PushesToPhones;
use Illuminate\Notifications\Notification;

/**
 * Tells the buyer the cashier recorded their payment (panel revision,
 * 20 Nov 2026): the items are set aside for them; they get them at the
 * PROWARE office with their issuance slip. Names what was not charged
 * because it was sold before they paid. Also pushed to their phones.
 */
class OrderPaid extends Notification implements PushesToPhones
{
    /**
     * @param  list<string>  $short  e.g. ["2 pcs of STI Lanyard (Blue)"]
     */
    public function __construct(public Order $order, public array $short = []) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', PushChannel::class];
    }

    /**
     * @return array{kind: string, order_id: int, order_number: string|null, items: string, total_centavos: int, short: string|null}
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'order_paid',
            'order_id' => $this->order->id,
            'order_number' => $this->order->number,
            'items' => $this->order->itemsText(handedOver: true),
            'total_centavos' => $this->order->total_centavos,
            'short' => $this->short === [] ? null : implode(', ', $this->short),
        ];
    }

    /**
     * "Payment received: STI Lanyard (Blue)": item names, not the PW- number.
     *
     * @return array{title: string, body: string, data: array<string, scalar|null>}
     */
    public function toPush(object $notifiable): array
    {
        return [
            'title' => "Payment received: {$this->order->itemsText(handedOver: true)}",
            'body' => self::body($this->order->total_centavos, $this->short === [] ? null : implode(', ', $this->short)),
            'data' => ['kind' => 'order_paid', 'order_id' => $this->order->id],
        ];
    }

    /**
     * "₱560.00 has been received. Present your issuance slip at the PROWARE office to claim your items."
     */
    public static function body(int $totalCentavos, ?string $short): string
    {
        return '₱'.number_format($totalCentavos / 100, 2).' has been received. Present your issuance slip at the PROWARE office to claim your items.'
            .($short === null ? '' : " Not charged (sold out before your payment): {$short}.");
    }
}
