<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Models\PurchaseOrder;
use App\Models\User;
use App\Notifications\PurchaseOrderReminder;
use App\Services\Deliveries\FollowUp;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

/**
 * The School Admin's ready-made reminder to the Specialist about a late
 * eStore order. Only for orders not complete after the follow-up days, and
 * at most once a week per order, so it monitors without getting in the way.
 */
class PurchaseOrderReminderController extends Controller
{
    public function store(Request $request, PurchaseOrder $purchaseOrder): RedirectResponse
    {
        $order = $purchaseOrder->order_number === null ? 'This order' : "Order #{$purchaseOrder->order_number}";

        DB::transaction(function () use ($request, $purchaseOrder, $order): void {
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
                'specialist_reminded_by' => $request->user()->id,
            ])->save();
        });

        $specialists = User::query()->where('role', UserRole::Specialist)->get();
        Notification::send($specialists, new PurchaseOrderReminder($purchaseOrder->refresh(), $request->user()));

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'The reminder has been sent to '.($specialists->isEmpty() ? 'the Specialist' : $specialists->pluck('name')->join(', ', ' and ')).'.',
        ]);

        return back();
    }
}
