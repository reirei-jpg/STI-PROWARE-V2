<?php

namespace App\Http\Controllers;

use App\Actions\PurchaseOrders\RemindSpecialist;
use App\Models\PurchaseOrder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * The School Admin's ready-made reminder to the Specialist about a late
 * eStore order (RemindSpecialist: late orders only, once a week).
 */
class PurchaseOrderReminderController extends Controller
{
    public function store(Request $request, PurchaseOrder $purchaseOrder, RemindSpecialist $remind): RedirectResponse
    {
        Inertia::flash('toast', [
            'type' => 'success',
            'message' => $remind->handle($purchaseOrder, $request->user()),
        ]);

        return back();
    }
}
