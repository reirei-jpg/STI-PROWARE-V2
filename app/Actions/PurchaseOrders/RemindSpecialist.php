<?php

namespace App\Actions\PurchaseOrders;

use App\Enums\UserRole;
use App\Models\PurchaseOrder;
use App\Models\User;
use App\Notifications\PurchaseOrderReminder;
use App\Services\Deliveries\FollowUp;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

/**
 * The School Admin's ready-made reminder to the Specialist about a late
 * eStore order (website and phone). Only for orders not complete after the
 * follow-up days, and at most once a week per order, so it monitors without
 * getting in the way.
 */
class RemindSpecialist
{
    /**
     * Send the reminder; the message says who received it.
     *
     * @throws ValidationException when the order is not late, or was reminded about this week
     */
    public function handle(PurchaseOrder $purchaseOrder, User $schoolAdmin): string
    {
        $order = $purchaseOrder->order_number === null ? 'This order' : "Order #{$purchaseOrder->order_number}";

        DB::transaction(function () use ($schoolAdmin, $purchaseOrder, $order): void {
            $purchaseOrder = PurchaseOrder::query()->lockForUpdate()->findOrFail($purchaseOrder->id);

            if (! FollowUp::isLate($purchaseOrder)) {
                throw ValidationException::withMessages([
                    'reminder' => "{$order} is not late, so there is nothing to remind the Specialist about.",
                ]);
            }

            $again = FollowUp::remindAgainOn($purchaseOrder);

            if ($again !== null) {
                throw ValidationException::withMessages([
                    'reminder' => "The Specialist was already reminded about {$order}. The next reminder can be sent on {$again->format('M j, Y')}.",
                ]);
            }

            $purchaseOrder->forceFill([
                'specialist_reminded_at' => now(),
                'specialist_reminded_by' => $schoolAdmin->id,
            ])->save();
        });

        $specialists = User::query()->where('role', UserRole::Specialist)->get();
        Notification::send($specialists, new PurchaseOrderReminder($purchaseOrder->refresh(), $schoolAdmin));

        return 'The reminder has been sent to '.($specialists->isEmpty() ? 'the Specialist' : $specialists->pluck('name')->join(', ', ' and ')).'.';
    }
}
