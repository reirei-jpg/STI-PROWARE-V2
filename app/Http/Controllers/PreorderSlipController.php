<?php

namespace App\Http\Controllers;

use App\Models\PreorderSlip;
use App\Services\Preorders\PreorderPayment;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

/**
 * The Specialist marks a preorder slip Paid after the buyer paid at the
 * cashier (from Scan slip). Shared with the phone (PreorderPayment).
 */
class PreorderSlipController extends Controller
{
    public function paid(Request $request, PreorderSlip $preorderSlip): RedirectResponse
    {
        try {
            Inertia::flash('toast', ['type' => 'success', 'message' => PreorderPayment::markPaid($preorderSlip, $request->user())]);
        } catch (ValidationException $refused) {
            Inertia::flash('toast', ['type' => 'error', 'message' => $refused->validator->errors()->first('slip')]);
        }

        return back();
    }
}
