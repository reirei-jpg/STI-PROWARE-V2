<?php

namespace App\Notifications;

use App\Models\ProductVariant;
use App\Notifications\Channels\PushChannel;
use App\Notifications\Channels\PushesToPhones;
use App\Services\Stock\ReorderPoints;
use App\Services\Stock\Units;
use Illuminate\Notifications\Notification;

/**
 * Tells the Specialist that a variant's stock fell to its Reorder Point (or
 * ran out), with how many to order, so she can order more in the eStore.
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
     * "Reorder now: STI Umbrella (Black)": the same words as the website's bell.
     *
     * @return array{title: string, body: string, data: array<string, scalar|null>}
     */
    public function toPush(object $notifiable): array
    {
        $alert = $this->toArray($notifiable);

        return [
            'title' => ($alert['stock_on_hand'] === 0 ? 'Out of stock' : 'Reorder now').": {$alert['product_name']}",
            'body' => self::body($alert['stock_on_hand'], $alert['alert_at'], $alert['suggested']),
            'data' => ['kind' => 'low_stock', 'product_id' => $alert['product_id']],
        ];
    }

    /**
     * "4 pcs left · Reorder Point 19 pcs. Suggested order: 30 pcs. Order more in the eStore."
     */
    public static function body(int $left, int $reorderPoint, ?int $suggested): string
    {
        return Units::count($left, 'Piece').' left · Reorder Point '.Units::count($reorderPoint, 'Piece').'.'
            .($suggested ? ' Suggested order: '.Units::count($suggested, 'Piece').'.' : '')
            .' Order more in the eStore.';
    }

    /**
     * @return array{kind: string, product_id: int, product_name: string, stock_on_hand: int, alert_at: int, suggested: int|null}
     */
    public function toArray(object $notifiable): array
    {
        $reorder = ReorderPoints::view($this->variant, ReorderPoints::onOrder([$this->variant])[$this->variant->id] ?? 0);

        return [
            'kind' => 'low_stock',
            'product_id' => $this->variant->product_id,
            'product_name' => $this->variant->displayName(),
            // Kept as stock_on_hand for the bell; it is the pieces free to sell.
            'stock_on_hand' => $this->variant->freeToSell(),
            // Kept as alert_at for older notices; it is the Reorder Point.
            'alert_at' => (int) $this->variant->reorder_point,
            'suggested' => $reorder['suggested'] ?? null,
        ];
    }
}
