<?php

namespace App\Notifications;

use App\Models\Preorder;
use App\Models\PreorderSlip;
use App\Notifications\Channels\PushChannel;
use App\Notifications\Channels\PushesToPhones;
use App\Services\Stock\Units;
use Illuminate\Notifications\Notification;

/**
 * Tells a buyer who paid for a preorder that their pieces arrived and are
 * set aside for them: show the preorder slip at the PROWARE office to get
 * them. Also pushed to their phones.
 */
class PreorderReady extends Notification implements PushesToPhones
{
    public function __construct(public Preorder $preorder, public int $pieces) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', PushChannel::class];
    }

    /**
     * @return array{kind: string, slip_id: int|null, number: string|null, product_id: int, product_name: string, variant_label: string|null, pieces: int}
     */
    public function toArray(object $notifiable): array
    {
        $slip = PreorderSlip::query()->where('batch', $this->preorder->batch)->first();

        return [
            'kind' => 'preorder_ready',
            'slip_id' => $slip?->id,
            'number' => $slip?->number,
            'product_id' => $this->preorder->product_id,
            'product_name' => $this->preorder->product->name,
            'variant_label' => $this->preorder->variant->choices === [] ? null : $this->preorder->variant->label(),
            'pieces' => $this->pieces,
        ];
    }

    /**
     * @return array{title: string, body: string, data: array<string, scalar|null>}
     */
    public function toPush(object $notifiable): array
    {
        $data = $this->toArray($notifiable);

        return [
            'title' => "Your preorder is ready to pick up: {$data['product_name']}".($data['variant_label'] === null ? '' : " ({$data['variant_label']})"),
            'body' => self::body($data['pieces'], $data['number']),
            'data' => ['kind' => 'preorder_ready', 'slip_id' => $data['slip_id']],
        ];
    }

    /**
     * "2 pcs are set aside for you. Show preorder slip PR-0002 at the
     * PROWARE office to get them."
     */
    public static function body(int $pieces, ?string $number): string
    {
        return Units::count($pieces, 'Piece').' '.($pieces === 1 ? 'is' : 'are')." set aside for you. Show preorder slip {$number} at the PROWARE office to get ".($pieces === 1 ? 'it.' : 'them.');
    }
}
