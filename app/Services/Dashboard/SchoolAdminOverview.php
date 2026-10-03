<?php

namespace App\Services\Dashboard;

use App\Enums\DeliveryStatus;
use App\Enums\OrderStatus;
use App\Enums\ProductStatus;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\PurchaseOrder;
use Illuminate\Database\Eloquent\Builder;

/**
 * What the School Admin monitors on the dashboard (view only): the cash
 * collected today and this week, the orders waiting, products low on
 * stock, where the eStore purchase orders stand, the best sellers this
 * month and the latest cancelled orders with their reasons.
 *
 * Money counts only orders picked up (paid in cash at the office).
 */
final class SchoolAdminOverview
{
    /**
     * @return array<string, mixed>
     */
    public function all(): array
    {
        return [
            'today' => $this->pickedUpSince(now()->startOfDay()),
            'week' => [
                ...$this->pickedUpSince(now()->startOfWeek()),
                'cancelled' => Order::query()->where('status', OrderStatus::Cancelled)->where('cancelled_at', '>=', now()->startOfWeek())->count(),
            ],
            'orders' => [
                'to_prepare' => Order::query()->where('status', OrderStatus::Placed)->count(),
                'ready' => Order::query()->where('status', OrderStatus::Ready)->count(),
                'ready_centavos' => (int) Order::query()->where('status', OrderStatus::Ready)->sum('total_centavos'),
            ],
            'stock' => [
                'low_products' => Product::query()->lowOnStock()->count(),
                'out_of_stock_products' => Product::query()
                    ->whereIn('status', [ProductStatus::Available, ProductStatus::OnSale])
                    ->whereHas('variants')
                    ->whereDoesntHave('variants', fn (Builder $variants) => $variants->where('stock_on_hand', '>', 0))
                    ->count(),
            ],
            'purchase_orders' => $this->purchaseOrders(),
            'best_sellers' => $this->bestSellers(),
            'cancellations' => $this->cancellations(),
        ];
    }

    /**
     * @return array{orders: int, centavos: int}
     */
    private function pickedUpSince(\DateTimeInterface $since): array
    {
        $query = Order::query()->where('status', OrderStatus::PickedUp)->where('picked_up_at', '>=', $since);

        return [
            'orders' => $query->count(),
            'centavos' => (int) $query->sum('total_centavos'),
        ];
    }

    /**
     * @return array{awaiting: int, partially_received: int, expected_this_week: int, next_expected: string|null}
     */
    private function purchaseOrders(): array
    {
        $expected = PurchaseOrder::query()
            ->whereIn('delivery_status', [DeliveryStatus::Awaiting, DeliveryStatus::PartiallyReceived])
            ->whereNotNull('expected_delivery_date')
            ->whereDate('expected_delivery_date', '<=', now()->endOfWeek()->toDateString());

        $next = $expected->clone()->orderBy('expected_delivery_date')->first();

        return [
            'awaiting' => PurchaseOrder::query()->where('delivery_status', DeliveryStatus::Awaiting)->count(),
            'partially_received' => PurchaseOrder::query()->where('delivery_status', DeliveryStatus::PartiallyReceived)->count(),
            'expected_this_week' => $expected->count(),
            'next_expected' => $next?->order_number,
        ];
    }

    /**
     * The three products with the most pieces picked up this month.
     *
     * @return list<array{product_id: int, name: string, pieces: int}>
     */
    private function bestSellers(): array
    {
        return array_values(OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.status', OrderStatus::PickedUp)
            ->where('orders.picked_up_at', '>=', now()->startOfMonth())
            ->groupBy('order_items.product_id')
            ->selectRaw('order_items.product_id, max(order_items.product_name) as name, sum(order_items.quantity * order_items.pieces_per_unit) as pieces')
            ->orderByDesc('pieces')
            ->orderBy('order_items.product_id')
            ->limit(3)
            ->get()
            ->map(fn (OrderItem $row): array => [
                'product_id' => (int) $row->getAttribute('product_id'),
                'name' => (string) $row->getAttribute('name'),
                'pieces' => (int) $row->getAttribute('pieces'),
            ])
            ->all());
    }

    /**
     * The five orders cancelled last, with why and by whom.
     *
     * @return list<array{number: string|null, student_name: string, reason: string|null, cancelled_by: string|null, cancelled_at: string|null}>
     */
    private function cancellations(): array
    {
        return array_values(Order::query()
            ->where('status', OrderStatus::Cancelled)
            ->with(['student', 'handler'])
            ->latest('cancelled_at')
            ->latest('id')
            ->limit(5)
            ->get()
            ->map(fn (Order $order): array => [
                'number' => $order->number,
                'student_name' => $order->student->name,
                'reason' => $order->cancel_reason,
                'cancelled_by' => $order->handler?->name,
                'cancelled_at' => $order->cancelled_at?->toIso8601String(),
            ])
            ->all());
    }
}
