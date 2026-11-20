<?php

namespace App\Services\Shop;

use App\Actions\Orders\MarkOrderPaid;
use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\PreorderSlip;
use App\Models\User;
use App\Services\Preorders\PreorderPayment;

/**
 * The cashier's screen, the same on the website and the phone (panel
 * revision, 20 Nov 2026): find a buyer's issuance slip (PW-0042) or
 * preorder slip (PR-0003) by its QR code or number, see what to collect,
 * and Mark as paid; below, what this cashier collected today.
 */
final class CashierDesk
{
    /**
     * A scanned or typed slip: an order's or a preorder's, or null when it
     * is not a PROWARE slip.
     *
     * @return array{kind: string, order?: array<string, mixed>, slip: array<string, mixed>, can_mark_paid: bool, refusal: string|null, to_collect_centavos: int|null, short: list<string>}|null
     */
    public static function lookup(string $code): ?array
    {
        $order = SpecialistOrders::findBySlip($code);
        $found = $order === null ? null : SpecialistOrders::bySlip($code);

        if ($order !== null && $found !== null) {
            $waiting = $order->status === OrderStatus::Placed;
            $preview = $waiting ? MarkOrderPaid::preview($order) : null;
            $nothingLeft = $preview !== null && $preview['total_centavos'] === 0;

            return [
                'kind' => 'order',
                'order' => $found['order'],
                'slip' => $found['slip'],
                'can_mark_paid' => $waiting && ! $nothingLeft,
                'refusal' => match (true) {
                    ! $waiting => MarkOrderPaid::notWaiting($order),
                    $nothingLeft => "Nothing of order {$order->number} is left in stock, so it cannot be paid. The buyer can cancel it and order again when it is back.",
                    default => null,
                },
                // What to collect now: only what is still left (first to pay, first served).
                'to_collect_centavos' => $preview['total_centavos'] ?? null,
                'short' => $preview['short'] ?? [],
            ];
        }

        $preorder = PreorderPayment::bySlip($code);

        if ($preorder === null) {
            return null;
        }

        return [
            'kind' => 'preorder',
            'slip' => $preorder['slip'],
            'can_mark_paid' => $preorder['can_mark_paid'],
            'refusal' => $preorder['refusal'],
            'to_collect_centavos' => $preorder['can_mark_paid'] ? $preorder['slip']['total_centavos'] : null,
            'short' => [],
        ];
    }

    /**
     * What this cashier marked paid today, the latest first, and the total.
     *
     * @return array{rows: list<array{kind: string, number: string|null, buyer: string, amount_centavos: int, paid_at: string|null}>, total_centavos: int}
     */
    public static function paidToday(User $cashier): array
    {
        $orders = Order::query()
            ->with('student')
            ->where('paid_to', $cashier->id)
            ->whereDate('paid_at', now()->toDateString())
            // A released paid preorder's order was collected on its slip.
            ->whereDoesntHave('preorders')
            ->get()
            ->map(fn (Order $order): array => [
                'kind' => 'order',
                'number' => $order->number,
                'buyer' => $order->student->name,
                'amount_centavos' => $order->total_centavos,
                'paid_at' => $order->paid_at?->toIso8601String(),
            ]);

        $slips = PreorderSlip::query()
            ->with('student')
            ->where('paid_by', $cashier->id)
            ->whereDate('paid_at', now()->toDateString())
            ->get()
            ->map(fn (PreorderSlip $slip): array => [
                'kind' => 'preorder',
                'number' => $slip->number,
                'buyer' => $slip->student->name,
                'amount_centavos' => (int) $slip->paid_centavos,
                'paid_at' => $slip->paid_at?->toIso8601String(),
            ]);

        $rows = $orders->concat($slips)->sortByDesc('paid_at')->values();

        return [
            'rows' => array_values($rows->all()),
            'total_centavos' => (int) $rows->sum('amount_centavos'),
        ];
    }
}
