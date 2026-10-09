<?php

namespace App\Notifications;

use App\Models\ProductVariant;
use App\Notifications\Channels\PushChannel;
use App\Notifications\Channels\PushesToPhones;
use App\Services\Stock\Units;
use Illuminate\Notifications\Notification;

/**
 * Tells the Specialist that a variant's stock fell to the product's
 * low-stock number (or ran out), so she can order more in the eStore.
 */
class LowStockAlert extends Notification implements PushesToPhones
{
    public function __construct(public ProductVariant $variant) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', PushChannel::class];
    }

    /**
     * "Low stock: STI Umbrella (Black)": the same words as the website's bell.
     *
     * @return array{title: string, body: string, data: array<string, scalar|null>}
     */
    public function toPush(object $notifiable): array
    {
        $alert = $this->toArray($notifiable);

        return [
            'title' => ($alert['stock_on_hand'] === 0 ? 'Out of stock' : 'Low stock').": {$alert['product_name']}",
            'body' => Units::count($alert['stock_on_hand'], 'Piece').' left · you are warned at '.Units::count($alert['alert_at'], 'Piece').'. Order more in the eStore.',
            'data' => ['kind' => 'low_stock', 'product_id' => $alert['product_id']],
        ];
    }

    /**
     * @return array{kind: string, product_id: int, product_name: string, stock_on_hand: int, alert_at: int}
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'low_stock',
            'product_id' => $this->variant->product_id,
            'product_name' => $this->variant->displayName(),
            // Kept as stock_on_hand for the bell; it is the pieces free to sell.
            'stock_on_hand' => $this->variant->freeToSell(),
            'alert_at' => $this->variant->product->low_stock_alert_at,
        ];
    }
}
