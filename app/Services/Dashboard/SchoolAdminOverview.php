<?php

namespace App\Services\Dashboard;

use App\Enums\DeliveryStatus;
use App\Models\Delivery;
use App\Models\DeliveryItem;
use App\Models\PurchaseOrder;
use App\Services\Deliveries\FollowUp;
use Carbon\CarbonInterface;

/**
 * What the School Admin monitors (view only): the purchase orders the
 * Specialist uploaded and the deliveries that arrived. Every upload,
 * delivery and short close shows who did it and when, so it can be traced.
 */
final class SchoolAdminOverview
{
    public const ACTIVITY_SHOWN = 10;

    /**
     * Two tabs: purchase orders (uploads and short closes) and deliveries.
     *
     * @return array{cards: array<string, mixed>, purchase_order_activity: list<array<string, mixed>>, delivery_activity: list<array<string, mixed>>, follow_up: array{days: int, count: int, orders: list<array<string, mixed>>}}
     */
    public function all(): array
    {
        $activity = collect($this->activity());

        return [
            'cards' => $this->cards(),
            'purchase_order_activity' => array_values($activity->whereIn('kind', ['upload', 'closed_short'])->values()->all()),
            'delivery_activity' => array_values($activity->where('kind', 'delivery')->values()->all()),
            'follow_up' => ['days' => FollowUp::days(), 'count' => FollowUp::dueOrders()->count(), 'orders' => $this->followUp()],
        ];
    }

    /**
     * @return array{awaiting: int, partially_received: int, partially_percent: int, completed: int, completed_short: int, deliveries_this_week: int, recorded_by: list<string>}
     */
    private function cards(): array
    {
        $partial = PurchaseOrder::query()->where('delivery_status', DeliveryStatus::PartiallyReceived)->get();
        $thisWeek = Delivery::query()->with('recorder')->where('received_on', '>=', now()->startOfWeek()->toDateString())->get();

        return [
            'awaiting' => PurchaseOrder::query()->where('delivery_status', DeliveryStatus::Awaiting)->count(),
            'partially_received' => $partial->count(),
            'partially_percent' => $partial->isEmpty() ? 0 : (int) round($partial->avg(fn (PurchaseOrder $order): int => $order->percentReceived())),
            'completed' => PurchaseOrder::query()->whereIn('delivery_status', [DeliveryStatus::Completed, DeliveryStatus::CompletedShort])->count(),
            'completed_short' => PurchaseOrder::query()->where('delivery_status', DeliveryStatus::CompletedShort)->count(),
            'deliveries_this_week' => $thisWeek->count(),
            'recorded_by' => array_values($thisWeek->map(fn (Delivery $delivery): string => $delivery->recorder->name)->unique()->all()),
        ];
    }

    /**
     * The latest uploads, deliveries and short closes, newest first.
     *
     * @return list<array<string, mixed>>
     */
    private function activity(): array
    {
        $uploads = PurchaseOrder::query()
            ->with('uploader')
            ->withCount('items')
            ->latest('created_at')
            ->limit(self::ACTIVITY_SHOWN)
            ->get()
            ->map(fn (PurchaseOrder $order): array => self::event(
                kind: 'upload',
                at: $order->created_at,
                by: $order->uploader->name,
                purchaseOrderId: $order->id,
                title: 'Purchase order uploaded'.self::number($order->order_number),
                detail: '₱'.number_format(((int) $order->total_amount_centavos) / 100, 2).' · '.$order->getAttribute('items_count').' '.((int) $order->getAttribute('items_count') === 1 ? 'item' : 'items').' · dated '.$order->date_ordered->format('M j, Y'),
            ));

        $deliveries = Delivery::query()
            ->with(['recorder', 'items.purchaseOrderItem.purchaseOrder'])
            ->latest('created_at')
            ->limit(self::ACTIVITY_SHOWN)
            ->get()
            ->map(function (Delivery $delivery): array {
                $orders = $delivery->items->map(fn (DeliveryItem $item): PurchaseOrder => $item->purchaseOrderItem->purchaseOrder)->unique('id')->values();
                $lines = $delivery->items->map(fn (DeliveryItem $item): string => $item->purchaseOrderItem->description.' '.number_format($item->quantity_received).' of '.number_format($item->purchaseOrderItem->quantity_ordered));
                $shown = $lines->take(3)->implode(', ').($lines->count() > 3 ? ' and '.($lines->count() - 3).' more' : '');
                $numbers = $orders->pluck('order_number')->filter()->map(fn (string $number): string => "#{$number}")->implode(', ');

                return self::event(
                    kind: 'delivery',
                    at: $delivery->created_at,
                    by: $delivery->recorder->name,
                    purchaseOrderId: $orders->first()?->id,
                    title: 'Delivery recorded'.($numbers !== '' ? " · Order {$numbers}" : ''),
                    detail: implode(' · ', array_filter([
                        'received '.$delivery->received_on->format('M j, Y'),
                        $delivery->sales_invoice_number ? "SI # {$delivery->sales_invoice_number}" : null,
                        $delivery->delivery_receipt_number ? "DR # {$delivery->delivery_receipt_number}" : null,
                        $shown,
                    ])),
                );
            });

        $shortCloses = PurchaseOrder::query()
            ->with('closer')
            ->whereNotNull('closed_at')
            ->latest('closed_at')
            ->limit(self::ACTIVITY_SHOWN)
            ->get()
            ->map(fn (PurchaseOrder $order): array => self::event(
                kind: 'closed_short',
                at: $order->closed_at,
                by: $order->closer?->name,
                purchaseOrderId: $order->id,
                title: 'Closed short'.self::number($order->order_number),
                detail: '"'.$order->closed_reason.'" · '.$order->percentReceived().'% received',
            ));

        // Each tab keeps its own newest ten.
        return array_values($uploads
            ->concat($shortCloses)
            ->sortByDesc('at')
            ->take(self::ACTIVITY_SHOWN)
            ->concat($deliveries)
            ->values()
            ->all());
    }

    /**
     * Open purchase orders not complete after the follow-up days, the
     * oldest first.
     *
     * @return list<array{purchase_order_id: int, order_number: string|null, date_ordered: string, days_since_ordered: int, percent_received: int}>
     */
    private function followUp(): array
    {
        return array_values(FollowUp::dueOrders()
            ->orderBy('date_ordered')
            ->orderBy('id')
            ->limit(self::ACTIVITY_SHOWN)
            ->get()
            ->map(fn (PurchaseOrder $order): array => [
                'purchase_order_id' => $order->id,
                'order_number' => $order->order_number,
                'date_ordered' => $order->date_ordered->toDateString(),
                'days_since_ordered' => FollowUp::daysSinceOrdered($order),
                'percent_received' => $order->percentReceived(),
            ])
            ->all());
    }

    private static function number(?string $orderNumber): string
    {
        return $orderNumber === null ? '' : " · Order #{$orderNumber}";
    }

    /**
     * @return array{kind: string, at: string|null, by: string|null, purchase_order_id: int|null, title: string, detail: string}
     */
    private static function event(string $kind, ?CarbonInterface $at, ?string $by, ?int $purchaseOrderId, string $title, string $detail): array
    {
        return [
            'kind' => $kind,
            'at' => $at?->toIso8601String(),
            'by' => $by,
            'purchase_order_id' => $purchaseOrderId,
            'title' => $title,
            'detail' => $detail,
        ];
    }
}
