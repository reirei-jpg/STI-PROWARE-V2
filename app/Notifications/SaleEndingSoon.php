<?php

namespace App\Notifications;

use App\Models\Product;
use Illuminate\Notifications\Notification;

/**
 * Tells the Specialist that a product's sale ends tomorrow, so she can
 * extend it or let it go back to its normal price.
 */
class SaleEndingSoon extends Notification
{
    public function __construct(public Product $product) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array{kind: string, product_id: int, product_name: string, ends_at: string|null}
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'sale_ending',
            'product_id' => $this->product->id,
            'product_name' => $this->product->name,
            'ends_at' => $this->product->sale_ends_at?->toIso8601String(),
        ];
    }
}
