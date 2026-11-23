<?php

namespace App\Services\Shop;

use App\Actions\Orders\MarkOrderPaid;
use App\Actions\Orders\UndoOrderPayment;
use App\Actions\Preorders\UndoPreorderPayment;
use App\Enums\OrderStatus;
use App\Models\Payment;
use App\Models\PreorderSlip;
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
     * @return array{kind: string, order?: array<string, mixed>, slip: array<string, mixed>, receipt: array{id: int, receipt_number: string|null}|null, can_mark_paid: bool, refusal: string|null, to_collect_centavos: int|null, short: list<string>, can_undo: bool}|null
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
                // Its Payment Receipt, once paid (none for an order paid before receipts were introduced).
                'receipt' => self::receiptLink(PaymentRecorder::standing($order)),
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
            'receipt' => self::receiptLink(PaymentRecorder::standing($slip)),
            'can_undo' => $slip->isPaid() && UndoPreorderPayment::refusal($slip) === null,
            'can_mark_paid' => $preorder['can_mark_paid'],
            'refusal' => $preorder['refusal'],
            'to_collect_centavos' => $preorder['can_mark_paid'] ? $preorder['slip']['total_centavos'] : null,
            'short' => [],
        ];
    }

    /**
     * Today's payments (every receipt issued today, the latest first) and
     * what they add up to; a void payment is listed but not counted.
     *
     * @return array{rows: list<array<string, mixed>>, total_centavos: int}
     */
    public static function paidToday(): array
    {
        $today = now()->toDateString();
        $filters = ['period' => 'today', 'date_from' => $today, 'date_to' => $today, 'method' => '', 'type' => '', 'status' => '', 'search' => '', 'group' => 'day'];

        return [
            'rows' => array_values(CashierRecords::query($filters)
                ->with(['cashier', 'voider', 'buyer', 'order', 'preorderSlip.preorders'])
                ->latest('paid_at')->latest('id')->get()
                ->map(fn (Payment $payment): array => CashierRecords::row($payment))->all()),
            'total_centavos' => CashierRecords::totals(CashierRecords::query($filters))['total_centavos'],
        ];
    }

    /**
     * @return array{id: int, receipt_number: string|null}|null
     */
    private static function receiptLink(?Payment $payment): ?array
    {
        return $payment === null ? null : ['id' => $payment->id, 'receipt_number' => $payment->receipt_number];
    }
}
