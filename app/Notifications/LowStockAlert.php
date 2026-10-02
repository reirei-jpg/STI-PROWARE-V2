<?php

namespace App\Notifications;

use App\Models\ProductVariant;
use Illuminate\Notifications\Notification;

/**
 * Tells the Specialist that a variant's stock fell to the product's
 * low-stock number (or ran out), so she can order more in the eStore.
 */
class LowStockAlert extends Notification
{
    public function __construct(public ProductVariant $variant) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
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
            'stock_on_hand' => $this->variant->stock_on_hand,
            'alert_at' => $this->variant->product->low_stock_alert_at,
        ];
    }
}
