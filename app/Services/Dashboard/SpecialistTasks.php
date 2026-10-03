<?php

namespace App\Services\Dashboard;

use App\Enums\DeliveryStatus;
use App\Enums\OrderStatus;
use App\Enums\PreorderStatus;
use App\Enums\ProductStatus;
use App\Models\DeliveryItem;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\PurchaseOrder;
use App\Services\Stock\LinkedItems;
use App\Services\Stock\Units;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;

/**
 * The Specialist's to-do list on the dashboard, most urgent first:
 *
 * - Do now: orders to prepare, low stock, deliveries waiting to be split
 *   by variant, and delivered items not linked to a product.
 * - Today: deliveries expected (or late), orders on their last pickup day,
 *   and sales ending today or tomorrow.
 * - This week: deliveries expected later, preorders closing, slow-moving
 *   items.
 *
 * A task disappears by itself once it is done. Long lists show the first
 * few and how many more there are.
 */
final class SpecialistTasks
{
    public const SHOWN_PER_KIND = 5;

    public const SLOW_MOVING_DAYS = 18;

    /**
     * @return array{now: list<array<string, mixed>>, today: list<array<string, mixed>>, week: list<array<string, mixed>>, cash: array{waiting_orders: int, waiting_centavos: int, collected_orders: int, collected_centavos: int}}
     */
    public function all(): array
    {
        $today = now()->startOfDay();

        return [
            'now' => [
                ...$this->ordersToPrepare(),
                ...$this->lowStock(),
                ...$this->waitingToSplit(),
                ...$this->arrivedNotLinked(),
            ],
            'today' => [
                ...$this->expectedDeliveries(null, $today->endOfDay()),
                ...$this->lastPickupDay(),
                ...$this->salesEnding(),
            ],
            'week' => [
                ...$this->expectedDeliveries($today->addDay(), $today->addDays(7)->endOfDay()),
                ...$this->preordersClosing(),
                ...$this->slowMoving(),
            ],
            'cash' => $this->cash(),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function ordersToPrepare(): array
    {
        $query = Order::query()->where('status', OrderStatus::Placed);
        $total = $query->count();

        $tasks = $query->clone()
            ->with('student')
            ->withCount('items')
            ->orderBy('pick_up_by')
            ->orderBy('id')
            ->limit(self::SHOWN_PER_KIND)
            ->get()
            ->map(fn (Order $order): array => self::task(
                key: "order-{$order->id}",
                kind: 'order',
                title: "Prepare {$order->number} · {$order->student->name}",
                detail: $order->getAttribute('items_count').' '.((int) $order->getAttribute('items_count') === 1 ? 'item' : 'items').' · ₱'.number_format($order->total_centavos / 100, 2).' · pick up by '.$order->pick_up_by->format('M j'),
                label: 'Ready for pickup',
                url: route('orders.ready', $order),
                method: 'post',
            ))
            ->all();

        return [...$tasks, ...self::more($total, 'more orders to prepare', route('orders.index'))];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function lowStock(): array
    {
        $query = ProductVariant::query()
            ->join('products', 'products.id', '=', 'product_variants.product_id')
            ->whereIn('products.status', [ProductStatus::Available, ProductStatus::OnSale])
            ->whereColumn('product_variants.stock_on_hand', '<=', 'products.low_stock_alert_at')
            ->select('product_variants.*');
        $total = $query->count();

        $tasks = $query->clone()
            ->with('product')
            ->orderBy('product_variants.stock_on_hand')
            ->orderBy('product_variants.id')
            ->limit(self::SHOWN_PER_KIND)
            ->get()
            ->map(fn (ProductVariant $variant): array => self::task(
                key: "low-{$variant->id}",
                kind: $variant->stock_on_hand === 0 ? 'out_of_stock' : 'low_stock',
                title: ($variant->stock_on_hand === 0 ? 'Out of stock: ' : 'Low stock: ').$variant->displayName(),
                detail: Units::count($variant->stock_on_hand, 'Piece').' left · warned at '.Units::count($variant->product->low_stock_alert_at, 'Piece').'. Order more in the eStore.',
                label: 'See stock',
                url: route('products.stock', $variant->product_id),
            ))
            ->all();

        return [...$tasks, ...self::more($total, 'more low on stock', route('products.index', ['stock' => 'low']))];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function waitingToSplit(): array
    {
        return array_values(LinkedItems::waitingToSplit()->map(fn (DeliveryItem $row): array => self::task(
            key: 'split-'.$row->getAttribute('item_code'),
            kind: 'split',
            title: $row->getAttribute('item_code').' arrived: split it into stock',
            detail: $row->getAttribute('description').' · '.number_format((int) $row->getAttribute('units_waiting')).' received. Enter how many of each variant came.',
            label: 'Split into stock',
            url: route('item-links.index'),
        ))->all());
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function arrivedNotLinked(): array
    {
        $codes = DeliveryItem::query()
            ->join('purchase_order_items', 'purchase_order_items.id', '=', 'delivery_items.purchase_order_item_id')
            ->whereDoesntHave('stockMovements')
            ->whereNotExists(fn ($variants) => $variants
                ->selectRaw('1')
                ->from('product_variants')
                ->whereColumn('product_variants.estore_item_code', 'purchase_order_items.item_code'))
            ->distinct()
            ->count('purchase_order_items.item_code');

        return $codes === 0 ? [] : [self::task(
            key: 'not-linked',
            kind: 'link',
            title: $codes === 1 ? '1 eStore item arrived but is not linked to a product' : "{$codes} eStore items arrived but are not linked to a product",
            detail: 'They are not counted as stock until you link them.',
            label: 'Link items',
            url: route('item-links.index'),
        )];
    }

    /**
     * Open orders expected from Head Office between the dates; with no
     * start, late ones too.
     *
     * @return list<array<string, mixed>>
     */
    private function expectedDeliveries(?CarbonInterface $from, CarbonInterface $to): array
    {
        return array_values(PurchaseOrder::query()
            ->whereIn('delivery_status', [DeliveryStatus::Awaiting, DeliveryStatus::PartiallyReceived])
            ->whereNotNull('expected_delivery_date')
            ->when($from, fn (Builder $query, CarbonInterface $start) => $query->whereDate('expected_delivery_date', '>=', $start->toDateString()))
            ->whereDate('expected_delivery_date', '<=', $to->toDateString())
            ->orderBy('expected_delivery_date')
            ->limit(self::SHOWN_PER_KIND)
            ->get()
            ->map(function (PurchaseOrder $order): array {
                /** @var CarbonInterface $date */
                $date = $order->expected_delivery_date;
                $when = match (true) {
                    $date->isToday() => 'today',
                    $date->isPast() => 'since '.$date->format('M j').' (late)',
                    default => $date->format('D, M j'),
                };

                return self::task(
                    key: "delivery-{$order->id}",
                    kind: 'delivery',
                    title: 'Delivery expected '.$when.($order->order_number ? ": Order #{$order->order_number}" : ''),
                    detail: $order->percentReceived().'% received so far'.($order->expected_delivery_note ? " · {$order->expected_delivery_note}" : ''),
                    label: 'Record Delivery',
                    url: route('deliveries.create'),
                );
            })
            ->all());
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function lastPickupDay(): array
    {
        return array_values(Order::query()
            ->open()
            ->whereDate('pick_up_by', now()->toDateString())
            ->with('student')
            ->orderBy('id')
            ->limit(self::SHOWN_PER_KIND)
            ->get()
            ->map(fn (Order $order): array => self::task(
                key: "last-day-{$order->id}",
                kind: 'last_day',
                title: "Last day to pick up {$order->number} · {$order->student->name}",
                detail: '₱'.number_format($order->total_centavos / 100, 2).' · '.$order->status->label().'. It cancels itself tonight if not picked up.',
                label: 'Open order',
                url: route('orders.index', ['show' => 'all', 'search' => $order->number]),
            ))
            ->all());
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function salesEnding(): array
    {
        return array_values(Product::query()
            ->where('status', ProductStatus::OnSale)
            ->where('sale_ends_at', '<=', now()->addDay()->endOfDay())
            ->orderBy('sale_ends_at')
            ->limit(self::SHOWN_PER_KIND)
            ->get()
            ->map(fn (Product $product): array => self::task(
                key: "sale-{$product->id}",
                kind: 'sale_ending',
                title: "Sale of {$product->name} ends ".($product->sale_ends_at?->isToday() ? 'today' : 'tomorrow'),
                detail: 'Extend it, or let it go back to its normal price.',
                label: 'Change sale',
                url: route('products.index', ['search' => $product->name]),
            ))
            ->all());
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function preordersClosing(): array
    {
        return array_values(Product::query()
            ->where('status', ProductStatus::Preorder)
            ->whereDate('preorders_close_on', '>=', now()->toDateString())
            ->whereDate('preorders_close_on', '<=', now()->addDays(7)->toDateString())
            ->withSum(['preorders as pieces_preordered' => fn (Builder $preorders) => $preorders->where('status', PreorderStatus::Active)], 'quantity')
            ->orderBy('preorders_close_on')
            ->limit(self::SHOWN_PER_KIND)
            ->get()
            ->map(fn (Product $product): array => self::task(
                key: "preorders-{$product->id}",
                kind: 'preorders',
                title: "Preorders for {$product->name} close ".($product->preorders_close_on?->isToday() ? 'today' : $product->preorders_close_on?->format('D, M j')),
                detail: Units::count((int) $product->getAttribute('pieces_preordered'), 'Piece').' preordered so far. Order them in the eStore after it closes.',
                label: 'See preorders',
                url: route('preorders.show', $product),
            ))
            ->all());
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function slowMoving(): array
    {
        $count = Product::query()->slowMoving(self::SLOW_MOVING_DAYS)->count();

        return $count === 0 ? [] : [self::task(
            key: 'slow-moving',
            kind: 'slow_moving',
            title: $count === 1 ? "1 item has not sold in {$this->days()}" : "{$count} items have not sold in {$this->days()}",
            detail: 'Put them on sale so they sell faster.',
            label: 'See slow-moving',
            url: route('products.index', ['stock' => 'slow']),
        )];
    }

    /**
     * Cash still to collect (orders ready for pickup) and collected today.
     *
     * @return array{waiting_orders: int, waiting_centavos: int, collected_orders: int, collected_centavos: int}
     */
    private function cash(): array
    {
        $ready = Order::query()->where('status', OrderStatus::Ready);
        $collected = Order::query()->where('status', OrderStatus::PickedUp)->whereDate('picked_up_at', now()->toDateString());

        return [
            'waiting_orders' => $ready->count(),
            'waiting_centavos' => (int) $ready->sum('total_centavos'),
            'collected_orders' => $collected->count(),
            'collected_centavos' => (int) $collected->sum('total_centavos'),
        ];
    }

    private function days(): string
    {
        return self::SLOW_MOVING_DAYS.' days';
    }

    /**
     * @return array{key: string, kind: string, title: string, detail: string, action: array{label: string, url: string, method: string}}
     */
    private static function task(string $key, string $kind, string $title, string $detail, string $label, string $url, string $method = 'get'): array
    {
        return [
            'key' => $key,
            'kind' => $kind,
            'title' => $title,
            'detail' => $detail,
            'action' => ['label' => $label, 'url' => $url, 'method' => $method],
        ];
    }

    /**
     * "And 3 more …" when a list is longer than what is shown.
     *
     * @return list<array<string, mixed>>
     */
    private static function more(int $total, string $what, string $url): array
    {
        $left = $total - self::SHOWN_PER_KIND;

        return $left <= 0 ? [] : [self::task(
            key: 'more-'.md5($what),
            kind: 'more',
            title: "And {$left} {$what}",
            detail: '',
            label: 'See all',
            url: $url,
        )];
    }
}
