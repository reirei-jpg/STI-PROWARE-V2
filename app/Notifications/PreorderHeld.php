<?php

namespace App\Notifications;

use App\Models\Preorder;
use App\Notifications\Channels\PushChannel;
use App\Notifications\Channels\PushesToPhones;
use App\Services\Stock\Units;
use Illuminate\Notifications\Notification;

/**
 * Tells a student their preordered pieces arrived and are held for them
 * until a time (24 hours). When only part arrived it says how many of how
 * many, and that they will be notified when the rest arrives. Also pushed
 * to their phones.
 */
class PreorderHeld extends Notification implements PushesToPhones
{
    /**
     * @param  int  $preordered  pieces the student was waiting for (the held ones and the rest)
     */
    public function __construct(public Preorder $preorder, public int $preordered) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', PushChannel::class];
    }

    /**
     * @return array{kind: string, preorder_id: int, product_id: int, product_name: string, variant_label: string|null, held: int, preordered: int, held_until: string|null}
     */
    public function toArray(object $notifiable): array
    {
        $variant = $this->preorder->variant;

        return [
            'kind' => 'preorder_held',
            'preorder_id' => $this->preorder->id,
            'product_id' => $this->preorder->product_id,
            'product_name' => $this->preorder->product->name,
            'variant_label' => $variant->choices === [] ? null : $variant->label(),
            'held' => $this->preorder->quantity,
            'preordered' => $this->preordered,
            'held_until' => $this->preorder->held_until?->toIso8601String(),
        ];
    }

    /**
     * @return array{title: string, body: string, data: array<string, scalar|null>}
     */
    public function toPush(object $notifiable): array
    {
        return [
            'title' => "Your preorder has arrived: {$this->preorder->variant->displayName()}",
            'body' => self::body($this->preorder->quantity, $this->preordered, $this->preorder->held_until?->format('M j, g:i A') ?? ''),
            'data' => ['kind' => 'preorder_held', 'product_id' => $this->preorder->product_id],
        ];
    }

    /**
     * "2 pcs are held for you until Oct 21, 3:00 PM. Order them in My
     * Preorders before then, or they go to the next student." For part of a
     * preorder: "20 of your 50 pcs have arrived … You will be notified when
     * the other 30 arrive."
     */
    public static function body(int $held, int $preordered, string $until): string
    {
        $start = $held === $preordered
            ? Units::count($held, 'Piece').' '.($held === 1 ? 'is' : 'are').' held for you'
            : "{$held} of your ".Units::count($preordered, 'Piece').' have arrived and are held for you';

        return "{$start} until {$until}. Order ".($held === 1 ? 'it' : 'them').' in My Preorders before then, or '.($held === 1 ? 'it goes' : 'they go').' to the next student.'
            .($held === $preordered ? '' : ' You will be notified when the other '.($preordered - $held).' arrive.');
    }
}
