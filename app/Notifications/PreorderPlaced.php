<?php

namespace App\Notifications;

use App\Models\Preorder;
use App\Notifications\Channels\PushChannel;
use App\Notifications\Channels\PushesToPhones;
use Illuminate\Notifications\Notification;

/**
 * Tells the Specialist a student preordered a sold-out size, so she can
 * order more in the eStore (or say it will not be restocked).
 */
class PreorderPlaced extends Notification implements PushesToPhones
{
    public function __construct(public Preorder $preorder) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', PushChannel::class];
    }

    /**
     * "New preorder: BSIT Polo (XS)": the same words as the website's bell.
     *
     * @return array{title: string, body: string, data: array<string, scalar|null>}
     */
    public function toPush(object $notifiable): array
    {
        $preorder = $this->toArray($notifiable);
        $pieces = $preorder['quantity'] === 1 ? 'piece' : 'pieces';

        return [
            'title' => 'New preorder: '.$preorder['product_name'].($preorder['variant_label'] === null ? '' : " ({$preorder['variant_label']})"),
            'body' => "{$preorder['student_name']} preordered {$preorder['quantity']} {$pieces}. It is out of stock.",
            'data' => ['kind' => 'preorder_placed', 'product_id' => $preorder['product_id']],
        ];
    }

    /**
     * @return array{kind: string, product_id: int, product_name: string, variant_label: string|null, student_name: string, quantity: int}
     */
    public function toArray(object $notifiable): array
    {
        $variant = $this->preorder->variant;

        return [
            'kind' => 'preorder_placed',
            'product_id' => $this->preorder->product_id,
            'product_name' => $this->preorder->product->name,
            'variant_label' => $variant->choices === [] ? null : $variant->label(),
            'student_name' => $this->preorder->student->name,
            'quantity' => $this->preorder->quantity,
        ];
    }
}
