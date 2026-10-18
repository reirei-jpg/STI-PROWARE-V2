<?php

namespace App\Notifications;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Notifications\Channels\PushChannel;
use App\Notifications\Channels\PushesToPhones;
use Illuminate\Notifications\Notification;

/**
 * Tells a student who preordered a product that it has arrived and can now
 * be bought: a Coming Soon product that went on sale, or a sold-out size
 * that is back in stock ($variant). Nothing is held for them: they add it
 * to the cart like anyone. Also pushed to their phones.
 */
class PreorderArrived extends Notification implements PushesToPhones
{
    public function __construct(public Product $product, public ?ProductVariant $variant = null) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', PushChannel::class];
    }

    /**
     * @return array{kind: string, product_id: int, product_name: string, variant_label: string|null}
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'preorder_arrived',
            'product_id' => $this->product->id,
            'product_name' => $this->product->name,
            'variant_label' => $this->variant === null || $this->variant->choices === [] ? null : $this->variant->label(),
        ];
    }

    /**
     * @return array{title: string, body: string, data: array<string, scalar|null>}
     */
    public function toPush(object $notifiable): array
    {
        $label = $this->toArray($notifiable)['variant_label'];

        return [
            'title' => $this->variant === null
                ? "Your preordered item is here: {$this->product->name}"
                : "Back in stock: {$this->product->name}".($label === null ? '' : " ({$label})"),
            'body' => 'You can now add it to your cart and order it. It is not held for you, so order soon.',
            'data' => ['kind' => 'preorder_arrived', 'product_id' => $this->product->id],
        ];
    }
}
