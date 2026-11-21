<?php

namespace App\Actions\Preorders;

use App\Enums\PreorderStatus;
use App\Enums\UserRole;
use App\Models\Payment;
use App\Models\PreorderSlip;
use App\Models\User;
use App\Notifications\PaymentUndone;
use App\Notifications\PaymentUndoneForStaff;
use App\Services\Preorders\EarlyBird;
use App\Services\Shop\PaymentRecorder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use LogicException;

/**
 * The cashier undoes a preorder slip's payment recorded by mistake: only the
 * same day and while its items have not arrived, with a reason. The slip is
 * waiting for payment again (its early-bird pieces are no longer kept as
 * paid), and its Payment Receipt stays on record as VOID with the reason.
 * The buyer is told; the Specialist only that it is waiting for payment again.
 */
class UndoPreorderPayment
{
    /**
     * Why its payment cannot be undone now, or null when it can.
     */
    public static function refusal(PreorderSlip $slip): ?string
    {
        if (! $slip->isPaid()) {
            return "Preorder slip {$slip->number} has no recorded payment to undo.";
        }

        if ($slip->preorders()->whereIn('status', [PreorderStatus::Arrived, PreorderStatus::Held, PreorderStatus::Ordered, PreorderStatus::HoldEnded])->exists()) {
            return "The items for preorder slip {$slip->number} have already arrived, so its payment can no longer be undone.";
        }

        if (! $slip->preorders()->where('status', PreorderStatus::Active)->exists()) {
            return "Preorder slip {$slip->number} has no open preorders, so its payment cannot be undone here.";
        }

        if (PaymentRecorder::standing($slip) === null) {
            return "Preorder slip {$slip->number} has no Payment Receipt to void, so its payment cannot be undone here.";
        }

        return Payment::notToday("preorder slip {$slip->number}", $slip->paid_at);
    }

    /**
     * @throws ValidationException when it is not paid, its items arrived, or it was paid on another day
     */
    public function handle(PreorderSlip $slip, User $cashier, string $reason): string
    {
        $voided = DB::transaction(function () use ($slip, $cashier, $reason): Payment {
            $locked = PreorderSlip::query()->lockForUpdate()->findOrFail($slip->id);
            $refusal = self::refusal($locked);

            if ($refusal !== null) {
                throw ValidationException::withMessages(['slip' => $refusal]);
            }

            $payment = PaymentRecorder::standing($locked) ?? throw new LogicException('A standing payment was checked above.');
            $payment->void($cashier, $reason);

            $locked->forceFill(['paid_at' => null, 'paid_by' => null, 'paid_centavos' => null])->save();
            $slip->setRawAttributes($locked->getAttributes(), true);

            return $payment;
        });

        $slip->loadMissing(['student', 'product']);
        // Its early-bird pieces are no longer kept as paid.
        EarlyBird::reallocate($slip->product);
        $slip->student->notify(new PaymentUndone($slip, $voided->amount_centavos, $reason, $voided->receipt_number));
        Notification::send(User::query()->where('role', UserRole::Specialist)->get(), new PaymentUndoneForStaff($slip));

        return "The payment for preorder slip {$slip->number} (₱".number_format($voided->amount_centavos / 100, 2)." from {$slip->student->name}) has been undone. Payment Receipt {$voided->receipt_number} is now VOID, and the slip is waiting for payment again.";
    }
}
