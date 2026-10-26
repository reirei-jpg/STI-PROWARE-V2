<?php

namespace App\Notifications;

use App\Models\Preorder;
use App\Models\Product;
use App\Notifications\Channels\PushChannel;
use App\Notifications\Channels\PushesToPhones;
use App\Services\Stock\Units;
use Illuminate\Notifications\Notification;

/**
 * Tells a student their preorder was received: the sizes and how many (an
 * added-to size shows its new total), and that they will be notified when
 * it arrives (or is back in stock, for a sold-out size). Also pushed to
 * their phones.
 */
class PreorderReceived extends Notification implements PushesToPhones
{
    /**
     * @param  list<Preorder>  $preorders  the sizes of one Preorder press
     */
    public function __construct(public Product $product, public array $preorders, public bool $soldOut) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', PushChannel::class];
    }

    /**
     * @return array{kind: string, product_id: int, product_name: string, lines: list<array{variant_label: string|null, quantity: int}>, sold_out: bool}
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'preorder_received',
            'product_id' => $this->product->id,
            'product_name' => $this->product->name,
            'lines' => array_map(fn (Preorder $preorder): array => [
                'variant_label' => $preorder->variant->choices === [] ? null : $preorder->variant->label(),
                'quantity' => $preorder->quantity,
            ], $this->preorders),
            'sold_out' => $this->soldOut,
        ];
    }

    /**
     * "Preorder received: BSIT Polo" / "2 × S, 3 × M are in My Preorders.
     * You will be notified when they are back in stock."
     *
     * @return array{title: string, body: string, data: array<string, scalar|null>}
     */
    public function toPush(object $notifiable): array
    {
        $notice = $this->toArray($notifiable);

        return [
            'title' => "Preorder received: {$notice['product_name']}",
            'body' => self::body($notice['lines'], $notice['sold_out']),
            'data' => ['kind' => 'preorder_received', 'product_id' => $notice['product_id']],
        ];
    }

    /**
     * @param  list<array{variant_label: string|null, quantity: int}>  $lines
     */
    public static function body(array $lines, bool $soldOut): string
    {
        $what = implode(', ', array_map(
            fn (array $line): string => $line['variant_label'] === null ? Units::count($line['quantity'], 'Piece') : "{$line['quantity']} × {$line['variant_label']}",
            $lines,
        ));
        $many = count($lines) > 1 || $lines[0]['quantity'] > 1;

        return "{$what} ".($many ? 'are' : 'is').' in My Preorders. You will be notified when '.($many ? 'they are' : 'it is').($soldOut ? ' back in stock.' : ' here.');
    }
}
