<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Http\Requests\ClosePurchaseOrderRequest;
use App\Models\PurchaseOrder;
use App\Models\User;
use App\Notifications\PurchaseOrderClosedShort;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

/**
 * The Specialist's delivery action on a single order: closing an order that
 * will never be fully delivered.
 */
class PurchaseOrderDeliveryController extends Controller
{
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
            'message' => "Order #{$purchaseOrder->order_number} was closed as Completed (short).",
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
