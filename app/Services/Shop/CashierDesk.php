<?php

namespace App\Services\Shop;

use App\Actions\Orders\MarkOrderPaid;
use App\Actions\Orders\UndoOrderPayment;
use App\Actions\Preorders\UndoPreorderPayment;
use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\PreorderSlip;
use App\Models\UndonePayment;
use App\Models\User;
use App\Services\Preorders\PreorderPayment;
use Illuminate\Database\Eloquent\Builder;

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
     * @return array{kind: string, order?: array<string, mixed>, slip: array<string, mixed>, can_mark_paid: bool, refusal: string|null, to_collect_centavos: int|null, short: list<string>, can_undo: bool}|null
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
                // Paid by mistake today and not released yet: Undo payment.
                'can_undo' => $order->status === OrderStatus::Paid && UndoOrderPayment::refusal($order) === null,
                'can_mark_paid' => $waiting && ! $nothingLeft,
                'refusal' => match (true) {
                    ! $waiting => MarkOrderPaid::notWaiting($order),
                    $nothingLeft => "None of the items in order {$order->number} are in stock, so the payment cannot be accepted. The buyer may cancel the order and place it again once the items are restocked.",
                    default => null,
                },
                // What to collect now: only what is still left (first to pay, first served).
                'to_collect_centavos' => $preview['total_centavos'] ?? null,
                'short' => $preview['short'] ?? [],
            ];
        }

        $preorder = PreorderPayment::bySlip($code);
        $slip = $preorder === null ? null : PreorderSlip::query()->find($preorder['slip']['slip_id']);

        if ($preorder === null || $slip === null) {
            return null;
        }

        return [
            'kind' => 'preorder',
            'slip' => $preorder['slip'],
            'can_undo' => $slip->isPaid() && UndoPreorderPayment::refusal($slip) === null,
            'can_mark_paid' => $preorder['can_mark_paid'],
            'refusal' => $preorder['refusal'],
            'to_collect_centavos' => $preorder['can_mark_paid'] ? $preorder['slip']['total_centavos'] : null,
            'short' => [],
        ];
    }

    /**
     * What this cashier marked paid today, the latest first, and the total;
     * a payment undone since then is listed as Undone (with its reason) and
     * left out of the total.
     *
     * @return array{rows: list<array{kind: string, number: string|null, buyer: string, amount_centavos: int, paid_at: string|null, undone: bool, reason: string|null}>, total_centavos: int}
     */
    public static function paidToday(User $cashier): array
    {
        $orders = Order::query()
            ->with('student')
            ->where('paid_to', $cashier->id)
            ->whereDate('paid_at', now()->toDateString())
            // A released paid preorder's order was collected on its slip (Order::holdsItems);
            // an order of an older held preorder was paid here like any order.
            ->whereDoesntHave('preorders', fn (Builder $preorders) => $preorders->whereNull('held_until'))
            ->get()
            ->map(fn (Order $order): array => [
                'kind' => 'order',
                'number' => $order->number,
                'buyer' => $order->student->name,
                'amount_centavos' => $order->total_centavos,
                'paid_at' => $order->paid_at?->toIso8601String(),
                'undone' => false,
                'reason' => null,
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
                'undone' => false,
                'reason' => null,
            ]);

        $undone = UndonePayment::query()
            ->with(['order.student', 'preorderSlip.student'])
            ->where('paid_by', $cashier->id)
            ->whereDate('paid_at', now()->toDateString())
            ->get()
            ->map(function (UndonePayment $payment): array {
                $paid = $payment->order ?? $payment->preorderSlip;

                return [
                    'kind' => $payment->order_id !== null ? 'order' : 'preorder',
                    'number' => $paid?->number,
                    'buyer' => (string) $paid?->student->name,
                    'amount_centavos' => $payment->amount_centavos,
                    'paid_at' => $payment->paid_at->toIso8601String(),
                    'undone' => true,
                    'reason' => $payment->reason,
                ];
            });

        $rows = $orders->concat($slips)->concat($undone)->sortByDesc('paid_at')->values();

        return [
            'rows' => array_values($rows->all()),
            'total_centavos' => (int) $rows->where('undone', false)->sum('amount_centavos'),
        ];
    }
}
