<?php

namespace App\Services\Dashboard;

use App\Enums\OrderStatus;
use App\Enums\ProductStatus;
use App\Enums\StockMovementType;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductAnnouncement;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Models\User;
use App\Notifications\ProductAnnounced;
use App\Services\Reports\PriceList;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

/**
 * The Top buyers card on the Specialist's dashboard (website and phone
 * To-do): the buyers who spent the most on released orders in the last 3
 * months, and telling the top 10, 20 or 50 of them about a product in
 * stock (a notice and a phone notification), once a day at most per
 * product.
 *
 * @phpstan-type BuyerRow array{user_id: int, name: string, email: string, orders: int, pieces: int, spent_centavos: int, last_bought_at: string|null}
 * @phpstan-type ProductChoice array{product_id: int, product_name: string, arrived_on: string|null, price_from_centavos: int|null, price_to_centavos: int|null, announced_at: string|null}
 * @phpstan-type LastAnnouncement array{product_name: string, top: int, recipients: int, note: string|null, sent_at: string|null, sent_by: string|null}
 */
final class TopBuyers
{
    public const MONTHS = 3;

    /** How many of the top buyers the Specialist can tell. */
    public const SIZES = [10, 20, 50];

    /** Buyers listed on the card. */
    public const SHOWN = 10;

    public const NOTE_MAX = 120;

    /**
     * @return array{from: string, buyers_count: int, items: list<BuyerRow>, sizes: list<int>, products: list<ProductChoice>, last: LastAnnouncement|null}
     */
    public static function card(): array
    {
        $from = self::from();
        $last = ProductAnnouncement::query()->with(['product', 'sender'])->latest('id')->first();

        return [
            'from' => $from->toDateString(),
            'buyers_count' => Order::query()
                ->where('status', OrderStatus::PickedUp)
                ->where('picked_up_at', '>=', $from)
                ->distinct()
                ->count('user_id'),
            'items' => self::top(self::SHOWN),
            'sizes' => self::SIZES,
            'products' => self::productsInStock(),
            'last' => $last === null ? null : [
                'product_name' => $last->product->name,
                'top' => $last->top,
                'recipients' => $last->recipients,
                'note' => $last->note,
                'sent_at' => $last->created_at?->toIso8601String(),
                'sent_by' => $last->sender?->name,
            ],
        ];
    }

    /**
     * The buyers who spent the most on released orders in the last 3
     * months, the most first.
     *
     * @return list<BuyerRow>
     */
    public static function top(int $limit): array
    {
        $rows = OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.status', OrderStatus::PickedUp)
            ->where('orders.picked_up_at', '>=', self::from())
            ->groupBy('orders.user_id')
            ->selectRaw('orders.user_id as user_id')
            ->selectRaw('count(distinct orders.id) as orders_count')
            ->selectRaw('coalesce(sum((order_items.quantity - order_items.quantity_short) * order_items.pieces_per_unit), 0) as pieces')
            ->selectRaw('coalesce(sum(order_items.line_total_centavos), 0) as spent')
            ->selectRaw('max(orders.picked_up_at) as last_bought_at')
            ->orderByDesc('spent')
            ->orderBy('orders.user_id')
            ->limit($limit)
            ->toBase()
            ->get();

        $users = User::query()->whereIn('id', $rows->pluck('user_id')->all())->get(['id', 'name', 'email'])->keyBy('id');

        return array_values($rows
            ->filter(fn (object $row): bool => $users->has($row->user_id))
            ->map(fn (object $row): array => [
                'user_id' => (int) $row->user_id,
                'name' => $users->get($row->user_id)->name,
                'email' => $users->get($row->user_id)->email,
                'orders' => (int) $row->orders_count,
                'pieces' => (int) $row->pieces,
                'spent_centavos' => (int) $row->spent,
                'last_bought_at' => $row->last_bought_at === null ? null : CarbonImmutable::parse((string) $row->last_bought_at)->toIso8601String(),
            ])
            ->all());
    }

    /**
     * Tell the top $top buyers that the product is in stock now.
     *
     * @throws ValidationException when it is not in stock, was already
     *                             announced in the last 24 hours, or no one bought yet
     */
    public static function announce(Product $product, int $top, ?string $note, User $sentBy): string
    {
        if (! self::inStock()->whereKey($product->id)->exists()) {
            throw ValidationException::withMessages(['product_id' => "{$product->name} is not in stock in the store, so there is nothing to announce."]);
        }

        $recent = ProductAnnouncement::query()
            ->with('sender')
            ->where('product_id', $product->id)
            ->where('created_at', '>', now()->subDay())
            ->latest('id')
            ->first();

        if ($recent !== null) {
            throw ValidationException::withMessages(['product_id' => "{$product->name} was already announced on {$recent->created_at?->format('M j, g:i A')}".($recent->sender ? " by {$recent->sender->name}" : '').'. It can be announced again 24 hours after that.']);
        }

        $buyers = User::query()->whereIn('id', array_column(self::top($top), 'user_id'))->get();

        if ($buyers->isEmpty()) {
            throw ValidationException::withMessages(['product_id' => 'No one has bought anything in the last '.self::MONTHS.' months, so there is no one to tell yet.']);
        }

        $note = $note === null || trim($note) === '' ? null : trim($note);
        Notification::send($buyers, new ProductAnnounced($product, $note));

        ProductAnnouncement::query()->create([
            'product_id' => $product->id,
            'sent_by' => $sentBy->id,
            'top' => $top,
            'recipients' => $buyers->count(),
            'note' => $note,
        ]);

        $who = $buyers->count() < $top
            ? "the {$buyers->count()} ".($buyers->count() === 1 ? 'buyer' : 'buyers').' of the last '.self::MONTHS.' months'
            : "the top {$top} buyers";

        return "{$product->name} has been announced to {$who}.";
    }

    private static function from(): CarbonImmutable
    {
        return CarbonImmutable::now()->subMonths(self::MONTHS)->startOfDay();
    }

    /**
     * Products students can buy now: Available or On Sale, with pieces free
     * to sell.
     *
     * @return Builder<Product>
     */
    private static function inStock(): Builder
    {
        return Product::query()
            ->whereIn('status', [ProductStatus::Available, ProductStatus::OnSale])
            ->whereHas('variants', fn (Builder $variants) => $variants->whereRaw(ProductVariant::FREE_TO_SELL_SQL.' > 0'));
    }

    /**
     * The products to choose from, the latest to arrive first, with their
     * price and when they were last announced.
     *
     * @return list<ProductChoice>
     */
    private static function productsInStock(): array
    {
        return array_values(self::inStock()
            ->with(['variants', 'packs'])
            ->addSelect([
                'arrived_at' => StockMovement::query()
                    ->join('product_variants', 'product_variants.id', '=', 'stock_movements.product_variant_id')
                    ->whereColumn('product_variants.product_id', 'products.id')
                    ->where('stock_movements.type', StockMovementType::Delivery)
                    ->selectRaw('max(stock_movements.created_at)'),
                'announced_at' => ProductAnnouncement::query()
                    ->whereColumn('product_announcements.product_id', 'products.id')
                    ->selectRaw('max(product_announcements.created_at)'),
            ])
            ->get()
            ->sortBy([
                fn (Product $a, Product $b): int => strcmp((string) $b->getAttribute('arrived_at'), (string) $a->getAttribute('arrived_at')),
                fn (Product $a, Product $b): int => strcasecmp($a->name, $b->name),
            ])
            ->map(function (Product $product): array {
                $prices = PriceList::studentPrices($product);
                $arrivedAt = $product->getAttribute('arrived_at');
                $announcedAt = $product->getAttribute('announced_at');

                return [
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'arrived_on' => $arrivedAt === null ? null : CarbonImmutable::parse((string) $arrivedAt)->toDateString(),
                    'price_from_centavos' => $prices->min(),
                    'price_to_centavos' => $prices->max(),
                    'announced_at' => $announcedAt === null ? null : CarbonImmutable::parse((string) $announcedAt)->toIso8601String(),
                ];
            })
            ->all());
    }
}
