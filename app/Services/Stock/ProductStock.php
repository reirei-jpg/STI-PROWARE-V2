<?php

namespace App\Services\Stock;

use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;

/**
 * A product's stock as the Specialist sees it (website Stock History page
 * and phone app): how many pieces each variant has on the shelf, how many of
 * those are held for students' open orders (and by whom), how many are free
 * to sell, and every change to the shelf count (deliveries, corrections,
 * released orders) with the balance after, newest first.
 *
 * @phpstan-type StockChange array{id: int, created_at: string|null, variant_label: string, type: string, type_label: string, quantity: int, balance_after: int, units_received: int|null, unit_name: string|null, pieces_per_unit: int|null, reason_label: string|null, note: string|null, delivery: array{received_on: string, sales_invoice_number: string|null, order_number: string|null}|null, order: array{number: string|null, student_name: string}|null, recorded_by: string|null}
 */
final class ProductStock
{
    /**
     * @return array{product: array{id: int, name: string, has_options: bool, stock_on_hand: int, held_pieces: int, free_to_sell: int, low_stock_alert_at: int, is_sold: bool}, variants: list<array{id: int, label: string, stock_on_hand: int, held_pieces: int, free_to_sell: int, estore_item_code: string|null, sent_by: string|null}>, holds: list<array{order_id: int, order_number: string|null, student_name: string, variant_label: string, pieces: int, pick_up_by: string}>}
     */
    public static function summary(Product $product): array
    {
        $product->loadMissing(['variants.estorePack']);

        return [
            'holds' => self::holds($product),
            'product' => [
                'id' => $product->id,
                'name' => $product->name,
                'has_options' => $product->variants->contains(fn (ProductVariant $variant): bool => $variant->choices !== []),
                'stock_on_hand' => (int) $product->variants->sum('stock_on_hand'),
                'held_pieces' => (int) $product->variants->sum('held_pieces'),
                'free_to_sell' => (int) $product->variants->sum(fn (ProductVariant $variant): int => $variant->freeToSell()),
                'low_stock_alert_at' => $product->low_stock_alert_at,
                'is_sold' => LowStockAlerts::isSold($product),
            ],
            'variants' => array_values($product->variants->map(fn (ProductVariant $variant): array => [
                'id' => $variant->id,
                'label' => $variant->label(),
                'stock_on_hand' => $variant->stock_on_hand,
                'held_pieces' => $variant->held_pieces,
                'free_to_sell' => $variant->freeToSell(),
                'estore_item_code' => $variant->estore_item_code,
                'sent_by' => $variant->estorePack?->label(),
            ])->all()),
        ];
    }

    /**
     * Who is holding the product's pieces: each open order's items, the
     * nearest pick-up date first.
     *
     * @return list<array{order_id: int, order_number: string|null, student_name: string, variant_label: string, pieces: int, pick_up_by: string}>
     */
    private static function holds(Product $product): array
    {
        return array_values(OrderItem::query()
            ->whereIn('product_variant_id', $product->variants()->select('id'))
            ->whereHas('order', fn (Builder $orders) => $orders->open())
            ->with(['order.student', 'variant'])
            ->get()
            ->sortBy(fn (OrderItem $item): string => $item->order->pick_up_by->toIso8601String())
            ->map(fn (OrderItem $item): array => [
                'order_id' => $item->order_id,
                'order_number' => $item->order->number,
                'student_name' => $item->order->student->name,
                'variant_label' => $item->variant->label(),
                'pieces' => $item->pieces(),
                'pick_up_by' => $item->order->pick_up_by->toDateString(),
            ])
            ->all());
    }

    /**
     * Every change to the product's stock, newest first, 20 at a time,
     * optionally for one variant.
     *
     * @return LengthAwarePaginator<int, StockChange>
     */
    public static function history(Product $product, ?int $variantId = null): LengthAwarePaginator
    {
        return StockMovement::query()
            ->whereIn('product_variant_id', $product->variants()->select('id'))
            ->when($variantId, fn (Builder $query, int $id) => $query->where('product_variant_id', $id))
            ->with(['variant', 'recorder', 'deliveryItem.delivery', 'deliveryItem.purchaseOrderItem.purchaseOrder', 'orderItem.order.student'])
            ->latest('id')
            ->paginate(20)
            ->withQueryString()
            ->through(fn (StockMovement $movement): array => [
                'id' => $movement->id,
                'created_at' => $movement->created_at?->toIso8601String(),
                'variant_label' => $movement->variant->label(),
                'type' => $movement->type->value,
                'type_label' => $movement->type->label(),
                'quantity' => $movement->quantity,
                'balance_after' => $movement->balance_after,
                'units_received' => $movement->units_received,
                'unit_name' => $movement->unit_name,
                'pieces_per_unit' => $movement->pieces_per_unit,
                'reason_label' => $movement->reason?->label(),
                'note' => $movement->note,
                'delivery' => $movement->deliveryItem === null ? null : [
                    'received_on' => $movement->deliveryItem->delivery->received_on->toDateString(),
                    'sales_invoice_number' => $movement->deliveryItem->delivery->sales_invoice_number,
                    'order_number' => $movement->deliveryItem->purchaseOrderItem->purchaseOrder->order_number,
                ],
                'order' => $movement->orderItem === null ? null : [
                    'number' => $movement->orderItem->order->number,
                    'student_name' => $movement->orderItem->order->student->name,
                ],
                'recorded_by' => $movement->recorder?->name,
            ]);
    }
}
