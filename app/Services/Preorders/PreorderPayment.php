<?php

namespace App\Services\Preorders;

use App\Actions\Preorders\ReleasePaidPreorder;
use App\Enums\PreorderStatus;
use App\Models\Preorder;
use App\Models\PreorderSlip;
use App\Models\User;
use App\Notifications\PreorderPaid;
use App\Services\Shop\IssuanceSlip;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Paying for preorders: the buyer brings the preorder slip (PR-0001) to the
 * cashier and pays its amount; the Specialist scans the slip (website or
 * phone) and marks it Paid. The slip then says PAID: it is the buyer's
 * proof of payment. A paid preorder can no longer be changed or cancelled,
 * and there is no refund.
 *
 * @phpstan-type SlipView array{kind: string, school: string, address_lines: list<string>, slip_id: int, number: string|null, date: string|null, student_name: string, student_id: string|null, section: string|null, is_staff: bool, product_id: int, product_name: string, items: list<array{quantity: int, item: string, unit_price_centavos: int, amount_centavos: int}>, total_centavos: int, status: string, status_label: string, paid_on: string|null, received_by: string|null, qr_svg: string}
 */
final class PreorderPayment
{
    /**
     * The slip as the buyer and the Specialist see it, laid out like the
     * issuance slip. While unpaid it lists the preorders still waiting;
     * once paid, what was paid for.
     *
     * @return SlipView
     */
    public static function view(PreorderSlip $slip): array
    {
        $slip->loadMissing(['student', 'product', 'payer']);
        $preorders = $slip->counted()->with(['product', 'variant'])->get();
        $items = [];

        foreach ($preorders as $preorder) {
            foreach (self::lines($preorder) as $line) {
                $items[] = $line;
            }
        }

        return [
            'kind' => 'preorder',
            'school' => IssuanceSlip::SCHOOL,
            'address_lines' => IssuanceSlip::ADDRESS_LINES,
            'slip_id' => $slip->id,
            'number' => $slip->number,
            'date' => $slip->created_at?->toDateString(),
            'student_name' => $slip->student->name,
            'student_id' => $slip->student->idNumber(),
            'section' => null,
            'is_staff' => $slip->student->isEmployee(),
            'product_id' => $slip->product_id,
            'product_name' => $slip->product->name,
            'items' => $items,
            'total_centavos' => $slip->amountDue(),
            'status' => $slip->isPaid() ? 'paid' : 'waiting_payment',
            'status_label' => $slip->isPaid() ? 'Paid' : 'Waiting for payment',
            'paid_on' => $slip->paid_at?->toDateString(),
            'received_by' => $slip->payer?->name,
            'qr_svg' => IssuanceSlip::qrSvg($slip->code),
        ];
    }

    /**
     * A preorder slip found by its QR code or its number (PR-0007), for the
     * Specialist's Scan slip; null when there is none.
     *
     * @return array{slip: SlipView, can_mark_paid: bool, refusal: string|null, can_release: bool, release_refusal: string|null, ready: list<array{item: string, pieces: int}>}|null
     */
    public static function bySlip(string $code): ?array
    {
        $code = trim($code);

        if ($code === '') {
            return null;
        }

        $slip = PreorderSlip::query()->where('code', $code)->orWhere('number', strtoupper($code))->first();

        if ($slip === null) {
            return null;
        }

        $refusal = self::refusal($slip);
        $releaseRefusal = $slip->isPaid() ? ReleasePaidPreorder::refusal($slip) : null;

        return [
            'slip' => self::view($slip),
            'can_mark_paid' => $refusal === null,
            'refusal' => $refusal,
            // Paid: its pieces that arrived and are set aside, to release.
            'can_release' => $slip->isPaid() && $releaseRefusal === null,
            'release_refusal' => $releaseRefusal,
            'ready' => array_values($slip->preorders()->where('status', PreorderStatus::Held)->with(['product', 'variant'])->get()
                ->map(fn (Preorder $preorder): array => [
                    'item' => $preorder->product->name.($preorder->variant->choices === [] ? '' : " ({$preorder->variant->label()})"),
                    'pieces' => $preorder->quantity,
                ])->all()),
        ];
    }

    /**
     * Why the slip cannot be marked Paid; null when it can.
     */
    public static function refusal(PreorderSlip $slip): ?string
    {
        $slip->loadMissing(['product', 'payer']);

        if ($slip->isPaid()) {
            return "Preorder slip {$slip->number} was already paid on {$slip->paid_at?->format('M j, Y g:i A')}".($slip->payer ? " (marked by {$slip->payer->name})" : '').'.';
        }

        if (! $slip->preorders()->where('status', PreorderStatus::Active)->exists()) {
            return "Preorder slip {$slip->number} has no preorder waiting any more (cancelled or closed), so there is nothing to pay.";
        }

        return null;
    }

    /**
     * Mark the slip Paid: the amount is kept as it is today, and the buyer
     * is told.
     *
     * @throws ValidationException when it is already paid or has nothing to pay
     */
    public static function markPaid(PreorderSlip $slip, User $by): string
    {
        $message = DB::transaction(function () use ($slip, $by): string {
            $locked = PreorderSlip::query()->lockForUpdate()->findOrFail($slip->id);
            $refusal = self::refusal($locked);

            if ($refusal !== null) {
                throw ValidationException::withMessages(['slip' => $refusal]);
            }

            $locked->forceFill([
                'paid_at' => now(),
                'paid_by' => $by->id,
                'paid_centavos' => $locked->amountDue(),
            ])->save();

            $slip->setRawAttributes($locked->getAttributes(), true);

            return "Preorder slip {$locked->number} has been marked as paid: ₱".number_format((int) $locked->paid_centavos / 100, 2)." from {$locked->student->name}.";
        });

        $slip->loadMissing(['student', 'product']);
        $slip->student->notify(new PreorderPaid($slip));

        return $message;
    }

    /**
     * Whether the preorder's slip is paid.
     */
    public static function isPaid(Preorder $preorder): bool
    {
        return PreorderSlip::query()->where('batch', $preorder->batch)->whereNotNull('paid_at')->exists();
    }

    /**
     * One preorder on the slip: its early-bird pieces and the rest on their
     * own lines when their prices differ.
     *
     * @return list<array{quantity: int, item: string, unit_price_centavos: int, amount_centavos: int}>
     */
    private static function lines(Preorder $preorder): array
    {
        $product = $preorder->product;
        $name = $product->name.($preorder->variant->choices === [] ? '' : " ({$preorder->variant->label()})");
        $total = PreorderSlip::amountOf($preorder);
        $earlyBird = $product->early_bird_price_centavos === null ? 0 : min($preorder->early_bird_pieces, $preorder->quantity);
        $rest = $preorder->quantity - $earlyBird;
        $lines = [];

        if ($earlyBird > 0) {
            $lines[] = ['quantity' => $earlyBird, 'item' => "{$name} · early bird", 'unit_price_centavos' => (int) $product->early_bird_price_centavos, 'amount_centavos' => $earlyBird * (int) $product->early_bird_price_centavos];
        }

        if ($rest > 0) {
            $restAmount = $total - $earlyBird * (int) $product->early_bird_price_centavos;
            $lines[] = ['quantity' => $rest, 'item' => $name, 'unit_price_centavos' => intdiv($restAmount, $rest), 'amount_centavos' => $restAmount];
        }

        return $lines;
    }
}
