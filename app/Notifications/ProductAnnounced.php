<?php

namespace App\Notifications;

use App\Models\Product;
use App\Notifications\Channels\PushChannel;
use App\Notifications\Channels\PushesToPhones;
use App\Services\Reports\PriceList;
use Illuminate\Notifications\Notification;

/**
 * Tells one of the top buyers that a product is in the store now, at its
 * price, with the Specialist's short note. Sent from the dashboard's Top
 * buyers card; also pushed to their phones. Opening it shows the product.
 */
class ProductAnnounced extends Notification implements PushesToPhones
{
    public function __construct(public Product $product, public ?string $note = null) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', PushChannel::class];
    }

    /**
     * @return array{kind: string, product_id: int, product_name: string, price_from_centavos: int|null, price_to_centavos: int|null, note: string|null}
     */
    public function toArray(object $notifiable): array
    {
        $prices = PriceList::studentPrices($this->product->loadMissing(['variants', 'packs']));

        return [
            'kind' => 'product_announced',
            'product_id' => $this->product->id,
            'product_name' => $this->product->name,
            'price_from_centavos' => $prices->min(),
            'price_to_centavos' => $prices->max(),
            'note' => $this->note,
        ];
    }

    /**
     * @return array{title: string, body: string, data: array<string, scalar|null>}
     */
    public function toPush(object $notifiable): array
    {
        $data = $this->toArray($notifiable);

        return [
            'title' => "New in the store: {$this->product->name}",
            'body' => self::body($data['price_from_centavos'], $data['price_to_centavos'], $data['note']),
            'data' => ['kind' => 'product_announced', 'product_id' => $this->product->id],
        ];
    }

    /**
     * "It is in stock now at ₱480.00. Limited stock."
     */
    public static function body(?int $priceFrom, ?int $priceTo, ?string $note): string
    {
        $price = match (true) {
            $priceFrom === null => '',
            $priceFrom === $priceTo => ' at ₱'.number_format($priceFrom / 100, 2),
            default => ' from ₱'.number_format($priceFrom / 100, 2),
        };

        return "It is in stock now{$price}.".($note === null || $note === '' ? '' : " {$note}");
    }
}
