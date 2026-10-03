<?php

namespace App\Notifications;

use App\Models\Product;
use Illuminate\Notifications\Notification;

/**
 * Tells a student who preordered a product that it has arrived and can now
 * be bought. Nothing is held for them: they add it to the cart like anyone.
 */
class PreorderArrived extends Notification
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
     * @return array{kind: string, product_id: int, product_name: string}
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'preorder_arrived',
            'product_id' => $this->product->id,
            'product_name' => $this->product->name,
        ];
    }
}
