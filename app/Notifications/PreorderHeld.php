<?php

namespace App\Notifications;

use App\Models\Preorder;
use App\Notifications\Channels\PushChannel;
use App\Notifications\Channels\PushesToPhones;
use App\Services\Shop\ShopPrice;
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
     * @return array{kind: string, preorder_id: int, product_id: int, product_name: string, variant_label: string|null, held: int, preordered: int, held_until: string|null, price_centavos: int|null, early_bird_pieces: int, early_bird_price_centavos: int|null}
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
            // The price of a piece now, which is what is paid (the price may have changed since it was preordered).
            'price_centavos' => $this->priceNow(),
            'early_bird_pieces' => $this->earlyBird()['earlyBirdPieces'],
            'early_bird_price_centavos' => $this->earlyBird()['earlyBirdPriceCentavos'],
        ];
    }

    /** One piece's price today, which is what is paid for pieces without the early-bird price. */
    private function priceNow(): ?int
    {
        return ShopPrice::perUnit($this->preorder->variant->setRelation('product', $this->preorder->product), null);
    }

    /**
     * The held pieces that keep the early-bird price, as Order Now charges them.
     *
     * @return array{earlyBirdPieces: int, earlyBirdPriceCentavos: int|null}
     */
    private function earlyBird(): array
    {
        $now = $this->priceNow();
        $earlyBirdPrice = $this->preorder->product->early_bird_price_centavos;
        $pieces = min($this->preorder->early_bird_pieces, $this->preorder->quantity);

        if ($now === null || $earlyBirdPrice === null || $earlyBirdPrice >= $now || $pieces < 1) {
            return ['earlyBirdPieces' => 0, 'earlyBirdPriceCentavos' => null];
        }

        return ['earlyBirdPieces' => $pieces, 'earlyBirdPriceCentavos' => $earlyBirdPrice];
    }

    /**
     * @return array{title: string, body: string, data: array<string, scalar|null>}
     */
    public function toPush(object $notifiable): array
    {
        return [
            'title' => "Your preorder has arrived: {$this->preorder->variant->displayName()}",
            'body' => self::body($this->preorder->quantity, $this->preordered, $this->preorder->held_until?->format('M j, g:i A') ?? '', $this->priceNow(), ...$this->earlyBird()),
            'data' => ['kind' => 'preorder_held', 'product_id' => $this->preorder->product_id],
        ];
    }

    /**
     * "2 pcs are held for you until Oct 21, 3:00 PM. Order them in My
     * Preorders before then, or they go to the next buyer." For part of a
     * preorder: "20 of your 50 pcs have arrived … You will be notified when
     * the other 30 arrive." With today's price: "… Price now: ₱520.00 each.", and
     * with early-bird pieces: "… Price now: ₱750.00 each, but the early-bird
     * price of ₱650.00 stays for 2 pcs."
     */
    public static function body(int $held, int $preordered, string $until, ?int $priceCentavos = null, int $earlyBirdPieces = 0, ?int $earlyBirdPriceCentavos = null): string
    {
        $start = $held === $preordered
            ? Units::count($held, 'Piece').' '.($held === 1 ? 'is' : 'are').' held for you'
            : "{$held} of your ".Units::count($preordered, 'Piece').($held === 1 ? ' has arrived and is' : ' have arrived and are').' held for you';

        $price = match (true) {
            $priceCentavos === null => '',
            $earlyBirdPieces > 0 && $earlyBirdPriceCentavos !== null => ' Price now: '.self::peso($priceCentavos).' each, but the early-bird price of '.self::peso($earlyBirdPriceCentavos).' stays for '.Units::count($earlyBirdPieces, 'Piece').'.',
            default => ' Price now: '.self::peso($priceCentavos).' each.',
        };

        return "{$start} until {$until}. Order ".($held === 1 ? 'it' : 'them').' in My Preorders before then, or '.($held === 1 ? 'it goes' : 'they go').' to the next buyer.'
            .($held === $preordered ? '' : ' You will be notified when the other '.($preordered - $held).' arrive.')
            .$price;
    }

    private static function peso(int $centavos): string
    {
        return '₱'.number_format($centavos / 100, 2);
    }
}
