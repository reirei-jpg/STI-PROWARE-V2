<?php

namespace App\Services\Shop;

use App\Actions\Orders\CancelOrderByStudent;
use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Validation\Rule;

/**
 * An order as the student's My Orders and the Specialist's Orders page show
 * it: number, status, dates, each item with its unit and price when ordered,
 * and the total to pay in cash. Expects the items and student to be loaded.
 */
final class OrderRow
{
    public const STUDENT_SHOW = ['waiting', 'past'];

    /**
     * Which tab of My Orders to show: Waiting (not released yet) by
     * default, or Past (released or cancelled).
     */
    public static function studentShow(Request $request): string
    {
        $validated = $request->validate(['show' => ['nullable', Rule::in(self::STUDENT_SHOW)]]);

        return $validated['show'] ?? 'waiting';
    }

    /**
     * A page of the student's My Orders (website and phone app): Waiting
     * orders by pick-up date, the most urgent first, or Past orders newest
     * first, 20 at a time.
     *
     * @return LengthAwarePaginator<int, array<string, mixed>>
     */
    public static function studentPage(User $student, string $show = 'waiting'): LengthAwarePaginator
    {
        return $student->orders()
            ->with(['items', 'student'])
            ->when(
                $show === 'waiting',
                fn (Builder $query) => $query->open()->orderBy('pick_up_by')->orderBy('id'),
                fn (Builder $query) => $query->whereNotIn('status', [OrderStatus::Placed, OrderStatus::Ready])->latest('id'),
            )
            ->paginate(20)
            ->withQueryString()
            ->through(fn (Order $order): array => self::forStudent($order));
    }

    /**
     * How many orders are on each tab of My Orders.
     *
     * @return array{waiting: int, past: int}
     */
    public static function studentCounts(User $student): array
    {
        $waiting = $student->orders()->open()->count();

        return ['waiting' => $waiting, 'past' => $student->orders()->count() - $waiting];
    }

    /**
     * The row on the student's own My Orders (website and phone app), with
     * whether they may still cancel it.
     *
     * @return array<string, mixed>
     */
    public static function forStudent(Order $order): array
    {
        return [
            ...self::of($order),
            'can_cancel' => CancelOrderByStudent::refusal($order) === null,
        ];
    }

    /**
     * With what the issuance slip needs: its QR code (slip_code) and the
     * student's course/section.
     *
     * @return array{id: int, number: string|null, slip_code: string|null, status: string, status_label: string, student_name: string, student_section: string|null, total_centavos: int, items: list<array{id: int, product_name: string, variant_label: string|null, unit_name: string, pieces_per_unit: int, quantity: int, unit_price_centavos: int, line_total_centavos: int}>, placed_at: string|null, pick_up_by: string, ready_at: string|null, picked_up_at: string|null, cancelled_at: string|null, expired: bool, cancel_reason: string|null}
     */
    public static function of(Order $order): array
    {
        return [
            'id' => $order->id,
            'number' => $order->number,
            'slip_code' => $order->slip_code,
            'status' => $order->status->value,
            'status_label' => $order->status->label(),
            'student_name' => $order->student->name,
            'student_section' => $order->student_section,
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
            'expired' => $order->expired_at !== null,
            'cancel_reason' => $order->cancel_reason,
        ];
    }
}
