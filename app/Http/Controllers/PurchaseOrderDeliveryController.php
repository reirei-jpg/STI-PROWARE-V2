<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Http\Requests\ClosePurchaseOrderRequest;
use App\Models\PurchaseOrder;
use App\Models\User;
use App\Notifications\PurchaseOrderClosedShort;
use App\Services\Deliveries\DeliveryScreens;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

/**
 * The Specialist's delivery actions on a single order: what is still to
 * arrive (for the Record Delivery popup on that order), and closing an
 * order that will never be fully delivered.
 */
class PurchaseOrderDeliveryController extends Controller
{
    /**
     * This order's items still waiting to arrive, for the Record Delivery
     * popup opened from the order, so only its items are listed.
     */
    public function waiting(PurchaseOrder $purchaseOrder): JsonResponse
    {
        return response()->json([
            'order_number' => $purchaseOrder->order_number,
            'is_open' => $purchaseOrder->delivery_status->isOpen(),
            'groups' => DeliveryScreens::waiting($purchaseOrder->id),
            'today' => now()->toDateString(),
        ]);
    }

    /**
     * Close an order short, with the reason, when Head Office will not
     * deliver the rest. The School Admin is told.
     */
    public function close(ClosePurchaseOrderRequest $request, PurchaseOrder $purchaseOrder): RedirectResponse
    {
        $this->ensureOpen($purchaseOrder, 'reason');

        $purchaseOrder->forceFill([
            'closed_reason' => trim((string) $request->input('reason')),
            'closed_at' => now(),
            'closed_by' => $request->user()->id,
        ]);
        $purchaseOrder->refreshDeliveryProgress();

        Notification::send(
            User::query()->where('role', UserRole::SchoolAdmin)->get(),
            new PurchaseOrderClosedShort($purchaseOrder->load('closer')),
        );

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => "Order #{$purchaseOrder->order_number} is now Completed (some missing).",
        ]);

        return back();
    }

    private function ensureOpen(PurchaseOrder $purchaseOrder, string $field): void
    {
        if (! $purchaseOrder->delivery_status->isOpen()) {
            throw ValidationException::withMessages([
                $field => "Order #{$purchaseOrder->order_number} is already {$purchaseOrder->delivery_status->label()}.",
            ]);
        }
    }
}
