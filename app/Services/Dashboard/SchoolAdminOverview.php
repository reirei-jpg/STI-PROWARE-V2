<?php

namespace App\Services\Dashboard;

use App\Enums\AdminDeliveryTab;
use App\Enums\DeliveryStatus;
use App\Models\PurchaseOrder;
use App\Services\Deliveries\FollowUp;
use Carbon\CarbonInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

/**
 * What the School Admin monitors (view only): every eStore order the
 * Specialist uploaded, in three tabs by what has arrived (Coming, Ongoing,
 * Completed), with the dates and times of each step. 5 orders a page. A
 * search by Order # narrows the list and the tab counts alike, so the
 * counts show which tab the order is in.
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
     * @return array{deliveries: array{tab: string, search: string|null, late_days: int, counts: array{coming: int, ongoing: int, completed: int, coming_late: int, ongoing_late: int}, orders: LengthAwarePaginator<int, array<string, mixed>>}}
     */
    public function all(AdminDeliveryTab $tab, ?string $search = null): array
    {
        return [
            'deliveries' => [
                'tab' => $tab->value,
                'search' => $search,
                'late_days' => FollowUp::days(),
                'counts' => $this->counts($search),
                'orders' => $this->orders($tab, $search),
            ],
        ];
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
        ];
    }
}
