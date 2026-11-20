<?php

namespace App\Actions\Preorders;

use App\Enums\PreorderStatus;
use App\Enums\UserRole;
use App\Models\PreorderSlip;
use App\Models\UndonePayment;
use App\Models\User;
use App\Notifications\PaymentUndone;
use App\Notifications\PaymentUndoneForStaff;
use App\Services\Preorders\EarlyBird;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

/**
 * The cashier undoes a preorder slip's payment recorded by mistake: only the
 * same day and while its items have not arrived, with a reason. The slip is
 * waiting for payment again (its early-bird pieces are no longer kept as
 * paid), and the payment is kept on record (UndonePayment). The buyer and
 * the Specialist are told.
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

        return UndonePayment::notToday("preorder slip {$slip->number}", $slip->paid_at);
    }

    /**
     * @throws ValidationException when it is not paid, its items arrived, or it was paid on another day
     */
    public function handle(PreorderSlip $slip, User $cashier, string $reason): string
    {
        $undone = DB::transaction(function () use ($slip, $cashier, $reason): UndonePayment {
            $locked = PreorderSlip::query()->lockForUpdate()->findOrFail($slip->id);
            $refusal = self::refusal($locked);

            if ($refusal !== null) {
                throw ValidationException::withMessages(['slip' => $refusal]);
            }

            $undone = UndonePayment::query()->create([
                'preorder_slip_id' => $locked->id,
                'amount_centavos' => (int) $locked->paid_centavos,
                'paid_at' => $locked->paid_at,
                'paid_by' => $locked->paid_by,
                'undone_by' => $cashier->id,
                'reason' => $reason,
            ]);

            $locked->forceFill(['paid_at' => null, 'paid_by' => null, 'paid_centavos' => null])->save();
            $slip->setRawAttributes($locked->getAttributes(), true);

            return $undone;
        });

        $slip->loadMissing(['student', 'product']);
        // Its early-bird pieces are no longer kept as paid.
        EarlyBird::reallocate($slip->product);
        $slip->student->notify(new PaymentUndone($slip, $undone->amount_centavos, $reason));
        Notification::send(User::query()->where('role', UserRole::Specialist)->get(), new PaymentUndoneForStaff($undone->load(['preorderSlip.student', 'undoer'])));

        return "The payment for preorder slip {$slip->number} (₱".number_format($undone->amount_centavos / 100, 2)." from {$slip->student->name}) has been undone. The slip is waiting for payment again.";
    }
}
