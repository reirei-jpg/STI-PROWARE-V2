<?php

namespace App\Notifications;

use App\Models\Product;
use App\Notifications\Channels\PushChannel;
use App\Notifications\Channels\PushesToPhones;
use Illuminate\Notifications\Notification;

/**
 * Tells a student with an active preorder that the Specialist set or
 * changed when the product is expected to arrive (e.g. Head Office is
 * late). Also pushed to their phones.
 */
class PreorderArrivalChanged extends Notification implements PushesToPhones
{
    public function __construct(public Product $product, public ?string $before = null) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', PushChannel::class];
    }

    /**
     * @return array{kind: string, product_id: int, product_name: string, expected_arrival: string|null, before: string|null}
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'preorder_arrival_changed',
            'product_id' => $this->product->id,
            'product_name' => $this->product->name,
            'expected_arrival' => $this->product->expectedArrivalText(),
            'before' => $this->before,
        ];
    }

    /**
     * @return array{title: string, body: string, data: array<string, scalar|null>}
     */
    public function toPush(object $notifiable): array
    {
        return [
            'title' => "New expected arrival: {$this->product->name}",
            'body' => "Your preorder is now expected to arrive {$this->product->expectedArrivalText()}."
                .($this->before === null ? '' : " It was expected {$this->before}."),
            'data' => ['kind' => 'preorder_arrival_changed', 'product_id' => $this->product->id],
        ];
    }
}
