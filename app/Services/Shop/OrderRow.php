<?php

namespace App\Services\Shop;

use App\Models\Order;
use App\Models\OrderItem;

/**
 * An order as the student's My Orders and the Specialist's Orders page show
 * it: number, status, dates, each item with its unit and price when ordered,
 * and the total to pay in cash. Expects the items and student to be loaded.
 */
final class OrderRow
{
    /**
     * @return array{id: int, number: string|null, status: string, status_label: string, student_name: string, total_centavos: int, items: list<array{id: int, product_name: string, variant_label: string|null, unit_name: string, pieces_per_unit: int, quantity: int, unit_price_centavos: int, line_total_centavos: int}>, placed_at: string|null, pick_up_by: string, ready_at: string|null, picked_up_at: string|null, cancelled_at: string|null, cancel_reason: string|null}
     */
    public static function of(Order $order): array
    {
        return [
            'id' => $order->id,
            'number' => $order->number,
            'status' => $order->status->value,
            'status_label' => $order->status->label(),
            'student_name' => $order->student->name,
            'total_centavos' => $order->total_centavos,
            'items' => array_values($order->items->map(fn (OrderItem $item): array => [
                'id' => $item->id,
                'product_name' => $item->product_name,
                'variant_label' => $item->variant_label,
                'unit_name' => $item->unit_name,
                'pieces_per_unit' => $item->pieces_per_unit,
                'quantity' => $item->quantity,
                'unit_price_centavos' => $item->unit_price_centavos,
                'line_total_centavos' => $item->line_total_centavos,
            ])->all()),
            'placed_at' => $order->created_at?->toIso8601String(),
            'pick_up_by' => $order->pick_up_by->toDateString(),
            'ready_at' => $order->ready_at?->toIso8601String(),
            'picked_up_at' => $order->picked_up_at?->toIso8601String(),
            'cancelled_at' => $order->cancelled_at?->toIso8601String(),
            'cancel_reason' => $order->cancel_reason,
        ];
    }
}
