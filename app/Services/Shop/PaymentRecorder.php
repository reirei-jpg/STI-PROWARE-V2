<?php

namespace App\Services\Shop;

use App\Enums\PaymentMethod;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\PreorderSlip;
use App\Models\User;
use App\Services\Preorders\PreorderPayment;
use Illuminate\Validation\ValidationException;

/**
 * Records a payment and its Payment Receipt, inside the caller's transaction,
 * once the amount due is known: cash must cover the amount due (the change
 * is kept), and a GCash reference can be on only one standing payment.
 */
final class PaymentRecorder
{
    /**
     * Why the payment cannot be recorded as entered, or null when it can.
     */
    public static function refusal(PaymentTender $tender, int $amountDueCentavos): ?string
    {
        if ($tender->method === PaymentMethod::Cash) {
            $received = (int) $tender->receivedCentavos;

            return $received < $amountDueCentavos
                ? 'The amount received ('.self::peso($received).') is less than the amount due ('.self::peso($amountDueCentavos).').'
                : null;
        }

        $used = Payment::query()->valid()->where('gcash_reference', $tender->gcashReference)->first();

        return $used === null
            ? null
            : "GCash reference {$tender->gcashReference} was already recorded on receipt {$used->receipt_number}.";
    }

    /**
     * @throws ValidationException when the cash does not cover the amount due, or the GCash reference was used
     */
    public static function record(Order|PreorderSlip $paid, int $amountDueCentavos, PaymentTender $tender, User $cashier): Payment
    {
        $refusal = self::refusal($tender, $amountDueCentavos);

        if ($refusal !== null) {
            throw ValidationException::withMessages([$tender->method === PaymentMethod::Cash ? 'amount_received' : 'gcash_reference' => $refusal]);
        }

        $isCash = $tender->method === PaymentMethod::Cash;

        return Payment::query()->create([
            'order_id' => $paid instanceof Order ? $paid->id : null,
            'preorder_slip_id' => $paid instanceof PreorderSlip ? $paid->id : null,
            'user_id' => $paid->user_id,
            'amount_centavos' => $amountDueCentavos,
            'method' => $tender->method,
            'amount_received_centavos' => $isCash ? $tender->receivedCentavos : null,
            'change_centavos' => $isCash ? (int) $tender->receivedCentavos - $amountDueCentavos : null,
            'gcash_reference' => $isCash ? null : $tender->gcashReference,
            'received_by' => $cashier->id,
            'paid_at' => now(),
            'snapshot' => self::snapshot($paid),
        ])->refresh();
    }

    /**
     * The receipt as issued: the buyer, the slip number and each line paid
     * for (an order's lines only as many as were charged).
     *
     * @return array{number: string|null, buyer_name: string, buyer_id: string|null, section: string|null, is_staff: bool, lines: list<array{quantity: int, item: string, unit_price_centavos: int, amount_centavos: int}>}
     */
    private static function snapshot(Order|PreorderSlip $paid): array
    {
        if ($paid instanceof PreorderSlip) {
            $view = PreorderPayment::view($paid);

            return [
                'number' => $paid->number,
                'buyer_name' => $view['student_name'],
                'buyer_id' => $view['student_id'],
                'section' => $view['section'],
                'is_staff' => $view['is_staff'],
                'lines' => array_map(fn (array $line): array => [
                    'quantity' => $line['quantity'],
                    'item' => $line['item'],
                    'unit_price_centavos' => $line['unit_price_centavos'],
                    'amount_centavos' => $line['amount_centavos'],
                ], $view['items']),
            ];
        }

        $paid->loadMissing(['items', 'student']);

        return [
            'number' => $paid->number,
            'buyer_name' => $paid->student->name,
            'buyer_id' => $paid->student->idNumber(),
            'section' => $paid->student_section,
            'is_staff' => $paid->student->isEmployee(),
            'lines' => array_values($paid->items
                ->filter(fn (OrderItem $item): bool => $item->quantity - $item->quantity_short > 0)
                ->map(fn (OrderItem $item): array => [
                    'quantity' => $item->quantity - $item->quantity_short,
                    'item' => IssuanceSlip::itemName($item),
                    'unit_price_centavos' => $item->unit_price_centavos,
                    'amount_centavos' => $item->line_total_centavos,
                ])
                ->all()),
        ];
    }

    /**
     * The standing payment of an order or preorder slip (the one to void), if any.
     */
    public static function standing(Order|PreorderSlip $paid): ?Payment
    {
        return Payment::query()
            ->valid()
            ->where($paid instanceof Order ? 'order_id' : 'preorder_slip_id', $paid->id)
            ->latest('id')
            ->first();
    }

    private static function peso(int $centavos): string
    {
        return '₱'.number_format($centavos / 100, 2);
    }
}
