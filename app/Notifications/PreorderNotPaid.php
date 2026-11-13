<?php

namespace App\Notifications;

use App\Models\Product;
use App\Notifications\Channels\PushChannel;
use App\Notifications\Channels\PushesToPhones;
use Illuminate\Notifications\Notification;

/**
 * Tells a buyer their preorder was dropped because it was not paid by the
 * close date of the payment dates. Also pushed to their phones.
 */
class PreorderNotPaid extends Notification implements PushesToPhones
{
    public function __construct(public Product $product, public string $closedOn) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', PushChannel::class];
    }

    /**
     * @return array{kind: string, product_id: int, product_name: string, closed_on: string}
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'preorder_not_paid',
            'product_id' => $this->product->id,
            'product_name' => $this->product->name,
            'closed_on' => $this->closedOn,
        ];
    }

    /**
     * @return array{title: string, body: string, data: array<string, scalar|null>}
     */
    public function toPush(object $notifiable): array
    {
        return [
            'title' => "Preorder dropped: {$this->product->name}",
            'body' => self::body($this->closedOn),
            'data' => ['kind' => 'preorder_not_paid', 'product_id' => $this->product->id],
        ];
    }

    /**
     * "It was not paid by Nov 30, 2026, so it was dropped."
     */
    public static function body(string $closedOn): string
    {
        return 'It was not paid by '.date('M j, Y', (int) strtotime($closedOn)).', so it was dropped.';
    }
}
