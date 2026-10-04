<?php

namespace App\Notifications;

use App\Models\Product;
use App\Notifications\Channels\PushChannel;
use App\Notifications\Channels\PushesToPhones;
use Illuminate\Notifications\Notification;

/**
 * Tells the Specialist that a product's sale ends tomorrow, so she can
 * extend it or let it go back to its normal price.
 */
class SaleEndingSoon extends Notification implements PushesToPhones
{
    public function __construct(public Product $product) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', PushChannel::class];
    }

    /**
     * "Sale ending tomorrow: STI Umbrella": the same words as the website's
     * bell.
     *
     * @return array{title: string, body: string, data: array<string, scalar|null>}
     */
    public function toPush(object $notifiable): array
    {
        $endsAt = $this->product->sale_ends_at?->timezone(config('app.timezone'))->format('M j, Y, g:i A');

        return [
            'title' => "Sale ending tomorrow: {$this->product->name}",
            'body' => ($endsAt ? "Ends {$endsAt}. " : '').'Open it to extend the sale, or let it go back to its normal price.',
            'data' => ['kind' => 'sale_ending', 'product_id' => $this->product->id],
        ];
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
