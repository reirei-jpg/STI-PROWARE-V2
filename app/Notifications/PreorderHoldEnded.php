<?php

namespace App\Notifications;

use App\Models\Preorder;
use App\Notifications\Channels\PushChannel;
use App\Notifications\Channels\PushesToPhones;
use App\Services\Stock\Units;
use Illuminate\Notifications\Notification;

/**
 * Tells a student the pieces held for them were not ordered within 24
 * hours, so the hold ended and they went to the next student, with the rest
 * of that preorder still on its way ($restClosed pieces). Also pushed to
 * their phones.
 */
class PreorderHoldEnded extends Notification implements PushesToPhones
{
    public function __construct(public Preorder $preorder, public int $restClosed = 0) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', PushChannel::class];
    }

    /**
     * @return array{kind: string, preorder_id: int, product_id: int, product_name: string, variant_label: string|null, held: int, rest_closed: int}
     */
    public function toArray(object $notifiable): array
    {
        $variant = $this->preorder->variant;

        return [
            'kind' => 'preorder_hold_ended',
            'preorder_id' => $this->preorder->id,
            'product_id' => $this->preorder->product_id,
            'product_name' => $this->preorder->product->name,
            'variant_label' => $variant->choices === [] ? null : $variant->label(),
            'held' => $this->preorder->quantity,
            'rest_closed' => $this->restClosed,
        ];
    }

    /**
     * @return array{title: string, body: string, data: array<string, scalar|null>}
     */
    public function toPush(object $notifiable): array
    {
        return [
            'title' => "Your hold has ended: {$this->preorder->variant->displayName()}",
            'body' => 'The '.Units::count($this->preorder->quantity, 'Piece').' held for you were not ordered within 24 hours, so they went to the next student.'
                .($this->restClosed > 0 ? ' The other '.Units::count($this->restClosed, 'Piece').' of this preorder will not be held for you either.' : '')
                .' Check the store if you still want it.',
            'data' => ['kind' => 'preorder_hold_ended', 'product_id' => $this->preorder->product_id],
        ];
    }
}
