<?php

namespace App\Notifications;

use App\Models\ProductVariant;
use App\Notifications\Channels\PushChannel;
use App\Notifications\Channels\PushesToPhones;
use Illuminate\Notifications\Notification;

/**
 * Tells a student who preordered a sold-out size that the Specialist said
 * it will not be restocked, so their preorder was closed. Her reason is
 * added when she gave one. Also pushed to their phones.
 */
class PreorderNotRestocked extends Notification implements PushesToPhones
{
    public function __construct(public ProductVariant $variant, public ?string $reason = null) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', PushChannel::class];
    }

    /**
     * @return array{kind: string, product_id: int, product_name: string, variant_label: string|null, reason: string|null}
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'preorder_not_restocked',
            'product_id' => $this->variant->product_id,
            'product_name' => $this->variant->product->name,
            'variant_label' => $this->variant->choices === [] ? null : $this->variant->label(),
            'reason' => $this->reason,
        ];
    }

    /**
     * @return array{title: string, body: string, data: array<string, scalar|null>}
     */
    public function toPush(object $notifiable): array
    {
        return [
            'title' => "Not restocked: {$this->variant->displayName()}",
            'body' => 'It will not be restocked, so your preorder has been closed.'.($this->reason === null ? '' : " Reason: {$this->reason}"),
            'data' => ['kind' => 'preorder_not_restocked', 'product_id' => $this->variant->product_id],
        ];
    }
}
