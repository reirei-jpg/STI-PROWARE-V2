<?php

namespace App\Http\Controllers;

use App\Http\Requests\ClosePurchaseOrderRequest;
use App\Http\Requests\SetExpectedDeliveryRequest;
use App\Models\PurchaseOrder;
use App\Services\Deliveries\DeliveryReminders;
use Illuminate\Http\RedirectResponse;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

/**
 * The Specialist's delivery actions on a single order: setting the date Head
 * Office said the items will arrive, and closing an order that will never be
 * fully delivered.
 */
class PurchaseOrderDeliveryController extends Controller
{
    /**
     * Set, change or clear the expected delivery date. Reminders already sent
     * for an old date do not count for the new one; any reminder already due
     * for the new date is sent right away.
     */
    public function setExpectedDate(SetExpectedDeliveryRequest $request, PurchaseOrder $purchaseOrder, DeliveryReminders $reminders): RedirectResponse
    {
        $this->ensureOpen($purchaseOrder, 'expected_delivery_date');

        $date = $request->input('expected_delivery_date');

        $purchaseOrder->clearExpectedDelivery();

        if (is_string($date) && $date !== '') {
            $purchaseOrder->forceFill([
                'expected_delivery_date' => $date,
                'expected_delivery_note' => $request->input('expected_delivery_note'),
            ]);
        }

        $purchaseOrder->save();
        $reminders->sendDue($purchaseOrder);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => $purchaseOrder->expected_delivery_date === null
                ? "The expected delivery date of Order #{$purchaseOrder->order_number} was cleared."
                : "Expected delivery of Order #{$purchaseOrder->order_number} set to {$purchaseOrder->expected_delivery_date->format('M j, Y')}.",
        ]);

        return back();
    }

    /**
     * Close an order short, with the reason, when Head Office will not
     * deliver the rest.
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
