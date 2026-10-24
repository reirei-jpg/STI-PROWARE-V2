<?php

namespace App\Services\Dashboard;

use App\Enums\AdminDeliveryTab;
use App\Enums\DeliveryStatus;
use App\Enums\OrderStatus;
use App\Enums\StockMovementType;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Services\Deliveries\FollowUp;
use App\Services\Reports\SalesReport;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator as Paginator;

/**
 * What the School Admin monitors (view only): every eStore order the
 * Specialist uploaded, in three tabs by what has arrived (Coming, Ongoing,
 * Completed), with the dates and times of each step. 5 orders a page. A
 * search by Order # narrows the list and the tab counts alike, so the
 * counts show which tab the order is in. Below: what sells (Top sellers in
 * a week, month or year) and what does not (slow-moving items), 5 a page.
 *
 * @phpstan-type TopSellerRow array{rank: int, product_id: int, product_name: string, pieces: int, price_total_centavos: int, profit_centavos: int|null, top_variant_label: string|null, top_variant_pieces: int}
 * @phpstan-type NotSellingRow array{product_id: int, product_name: string, stock_pieces: int, first_arrived_at: string|null, last_sold_at: string|null, days_without_sale: int}
 */
final class SchoolAdminOverview
{
    public const PER_PAGE = 5;

    /** When an order's last delivery was recorded. */
    private const LAST_DELIVERY_SQL = '(select max(deliveries.created_at) from deliveries'
        .' join delivery_items on delivery_items.delivery_id = deliveries.id'
        .' join purchase_order_items on purchase_order_items.id = delivery_items.purchase_order_item_id'
        .' where purchase_order_items.purchase_order_id = purchase_orders.id)';

    /**
     * @return array{deliveries: array{tab: string, search: string|null, late_days: int, counts: array{coming: int, ongoing: int, completed: int, coming_late: int, ongoing_late: int}, orders: LengthAwarePaginator<int, array<string, mixed>>}, sales: array{period: string, from: string, to: string, top_sellers: Paginator<int, TopSellerRow>, slow_days: int, not_selling: Paginator<int, NotSellingRow>}}
     */
    public function all(AdminDeliveryTab $tab, ?string $search = null, string $period = 'month'): array
    {
        $from = match ($period) {
            'week' => CarbonImmutable::now()->startOfWeek(),
            'year' => CarbonImmutable::now()->startOfYear(),
            default => CarbonImmutable::now()->startOfMonth(),
        };
        $to = CarbonImmutable::now()->endOfDay();

        return [
            'deliveries' => [
                'tab' => $tab->value,
                'search' => $search,
                'late_days' => FollowUp::days(),
                'counts' => $this->counts($search),
                'orders' => $this->orders($tab, $search),
            ],
            'sales' => [
                'period' => $period,
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
                // The Specialist's Best sellers (Sales Reports), 5 a page.
                'top_sellers' => SalesReport::bestSellers($from, $to, self::PER_PAGE, 'top_page'),
                'slow_days' => SpecialistTasks::SLOW_MOVING_DAYS,
                'not_selling' => $this->notSelling(),
            ],
        ];
    }

    /**
     * Products not selling: in stock, first arrived at least the slow-moving
     * days ago, and nothing sold in those days (the same rule as the
     * Specialist's slow-moving items). Never sold first, then the longest
     * without a sale.
     *
     * @return Paginator<int, NotSellingRow>
     */
    private function notSelling(): Paginator
    {
        $lastSale = '(select max(sm.created_at) from stock_movements sm'
            .' join product_variants pv on pv.id = sm.product_variant_id'
            .' left join order_items oi on oi.id = sm.order_item_id'
            .' left join orders o on o.id = oi.order_id'
            ." where pv.product_id = products.id and sm.type = '".StockMovementType::Sale->value."'"
            ." and (o.status is null or o.status <> '".OrderStatus::Cancelled->value."'))";
        $firstArrival = '(select min(sm.created_at) from stock_movements sm'
            .' join product_variants pv on pv.id = sm.product_variant_id'
            .' where pv.product_id = products.id)';

        return Product::query()
            ->slowMoving(SpecialistTasks::SLOW_MOVING_DAYS)
            ->select('products.*')
            ->selectRaw("{$lastSale} as last_sold_at")
            ->selectRaw("{$firstArrival} as first_arrived_at")
            ->withCasts(['last_sold_at' => 'datetime', 'first_arrived_at' => 'datetime'])
            ->withSum('variants as stock_pieces', 'stock_on_hand')
            ->orderByRaw("case when {$lastSale} is null then 0 else 1 end")
            ->orderByRaw($lastSale)
            ->orderBy('products.name')
            ->paginate(self::PER_PAGE, ['*'], 'slow_page')
            ->withQueryString()
            ->through(function (Product $product): array {
                /** @var CarbonInterface|null $lastSold */
                $lastSold = $product->getAttribute('last_sold_at');
                /** @var CarbonInterface|null $firstArrived */
                $firstArrived = $product->getAttribute('first_arrived_at');

                return [
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'stock_pieces' => (int) $product->getAttribute('stock_pieces'),
                    'first_arrived_at' => $firstArrived?->toIso8601String(),
                    'last_sold_at' => $lastSold?->toIso8601String(),
                    'days_without_sale' => (int) ($lastSold ?? $firstArrived ?? now())->copy()->startOfDay()->diffInDays(now()->startOfDay()),
                ];
            });
    }

    /**
     * Orders whose Order # has the search in it.
     *
     * @param  Builder<PurchaseOrder>  $query
     * @return Builder<PurchaseOrder>
     */
    private static function matching(Builder $query, ?string $search): Builder
    {
        return $query->when($search, fn (Builder $orders, string $orderNumber) => $orders->whereLike('order_number', "%{$orderNumber}%"));
    }

    /**
     * @return array{coming: int, ongoing: int, completed: int, coming_late: int, ongoing_late: int}
     */
    private function counts(?string $search): array
    {
        $byStatus = self::matching(PurchaseOrder::query(), $search)
            ->selectRaw('delivery_status, count(*) as total')
            ->groupBy('delivery_status')
            ->pluck('total', 'delivery_status');
        $count = fn (AdminDeliveryTab $tab): int => (int) collect($tab->statuses())->sum(fn (DeliveryStatus $status): int => (int) ($byStatus[$status->value] ?? 0));

        $late = self::matching(FollowUp::dueOrders(), $search)
            ->selectRaw('delivery_status, count(*) as total')
            ->groupBy('delivery_status')
            ->pluck('total', 'delivery_status');

        return [
            'coming' => $count(AdminDeliveryTab::Coming),
            'ongoing' => $count(AdminDeliveryTab::Ongoing),
            'completed' => $count(AdminDeliveryTab::Completed),
            'coming_late' => (int) ($late[DeliveryStatus::Awaiting->value] ?? 0),
            'ongoing_late' => (int) ($late[DeliveryStatus::PartiallyReceived->value] ?? 0),
        ];
    }

    /**
     * Coming and Ongoing: the oldest Date Ordered first, so late orders lead.
     * Completed: the most recently completed first.
     *
     * @return LengthAwarePaginator<int, array<string, mixed>>
     */
    private function orders(AdminDeliveryTab $tab, ?string $search): LengthAwarePaginator
    {
        $query = self::matching(PurchaseOrder::query(), $search)
            ->select('purchase_orders.*')
            ->selectRaw(self::LAST_DELIVERY_SQL.' as last_delivery_at')
            ->withCasts(['last_delivery_at' => 'datetime'])
            ->with('reminder')
            ->withCount('items')
            ->whereIn('delivery_status', $tab->statuses());

        if ($tab === AdminDeliveryTab::Completed) {
            $query->orderByRaw('coalesce(purchase_orders.closed_at, '.self::LAST_DELIVERY_SQL.') desc');
        } else {
            $query->orderBy('date_ordered');
        }

        $lateDays = FollowUp::days();

        return $query->orderBy('purchase_orders.id')
            ->paginate(self::PER_PAGE)
            ->withQueryString()
            ->through(fn (PurchaseOrder $order): array => self::row($order, $lateDays));
    }

    /**
     * @return array<string, mixed>
     */
    private static function row(PurchaseOrder $order, int $lateDays): array
    {
        /** @var CarbonInterface|null $lastDelivery */
        $lastDelivery = $order->getAttribute('last_delivery_at');
        $completedAt = match ($order->delivery_status) {
            DeliveryStatus::Completed => $lastDelivery,
            DeliveryStatus::CompletedShort => $order->closed_at,
            default => null,
        };
        $daysSinceOrdered = FollowUp::daysSinceOrdered($order);

        return [
            'id' => $order->id,
            'order_number' => $order->order_number,
            'category' => $order->category,
            'date_ordered' => $order->date_ordered->toDateString(),
            'days_since_ordered' => $daysSinceOrdered,
            'items_count' => (int) $order->getAttribute('items_count'),
            'uploaded_at' => $order->created_at?->toIso8601String(),
            'last_delivery_at' => $lastDelivery?->toIso8601String(),
            'completed_at' => $completedAt?->toIso8601String(),
            'completed_after_days' => $completedAt === null ? null : (int) $order->date_ordered->copy()->startOfDay()->diffInDays($completedAt->copy()->startOfDay()),
            'status' => $order->delivery_status->value,
            'status_label' => $order->delivery_status->label(),
            'percent_received' => $order->percentReceived(),
            'quantity_ordered' => $order->quantity_ordered_total,
            'quantity_received' => $order->quantity_received_total,
            'is_late' => $order->delivery_status->isOpen() && $daysSinceOrdered >= $lateDays,
            ...self::reminder($order),
        ];
    }

    /**
     * When the Specialist was last reminded about the order, and whether the
     * School Admin may remind them now (a late order, once a week).
     *
     * @return array{reminded_at: string|null, reminded_by: string|null, can_remind: bool, remind_again_on: string|null}
     */
    public static function reminder(PurchaseOrder $order): array
    {
        return [
            'reminded_at' => $order->specialist_reminded_at?->toIso8601String(),
            'reminded_by' => $order->reminder?->name,
            'can_remind' => FollowUp::canRemind($order),
            'remind_again_on' => FollowUp::remindAgainOn($order)?->toDateString(),
        ];
    }
}
