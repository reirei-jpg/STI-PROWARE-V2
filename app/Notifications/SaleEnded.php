<?php

namespace App\Notifications;

use App\Models\Product;
use Illuminate\Notifications\Notification;

/**
 * Tells the Specialist that a product's sale ended by itself and it is
 * back to its normal price.
 */
class SaleEnded extends Notification
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
     * @return array{kind: string, product_id: int, product_name: string, normal_price: string}
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'sale_ended',
            'product_id' => $this->product->id,
            'product_name' => $this->product->name,
            'normal_price' => $this->normalPrice(),
        ];
    }

    /**
     * "₱80.00 / pc", or the first pack students can buy, "₱900.00 / Pack of 50".
     */
    private function normalPrice(): string
    {
        if ($this->product->sold_by_piece && $this->product->price_centavos !== null) {
            return '₱'.number_format($this->product->price_centavos / 100, 2).' / pc';
        }

        $pack = $this->product->packs()->where('sold_to_students', true)->first();

        return $pack === null
            ? 'its normal price'
            : '₱'.number_format((int) $pack->price_centavos / 100, 2)." / {$pack->name} of {$pack->pieces}";
    }
}
