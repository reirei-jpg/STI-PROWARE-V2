<?php

namespace App\Http\Controllers;

use App\Actions\Preorders\ReleasePaidPreorder;
use App\Http\Requests\FilterPreorderSlipsRequest;
use App\Models\PreorderSlip;
use App\Services\Preorders\PreorderPayment;
use App\Services\Preorders\PreorderSlipList;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

/**
 * The Specialist marks a preorder slip Paid after the buyer paid at the
 * cashier, and later releases its pieces that arrived (from Scan slip).
 * Shared with the phone (PreorderPayment, ReleasePaidPreorder).
 */
class PreorderSlipController extends Controller
{
    /**
     * The Preorders card's list on the dashboard: slips to verify or paid.
     */
    public function index(FilterPreorderSlipsRequest $request): JsonResponse
    {
        return response()->json([
            ...PreorderSlipList::page($request->tab(), $request->search())->toArray(),
            'counts' => PreorderSlipList::counts(),
        ]);
    }

    /**
     * Release the paid preorder's pieces that arrived and are set aside.
     */
    public function release(Request $request, PreorderSlip $preorderSlip, ReleasePaidPreorder $releasePreorder): RedirectResponse
    {
        try {
            Inertia::flash('toast', ['type' => 'success', 'message' => $releasePreorder->handle($preorderSlip, $request->user())]);
        } catch (ValidationException $refused) {
            Inertia::flash('toast', ['type' => 'error', 'message' => $refused->validator->errors()->first('slip')]);
        }

        return back();
    }

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
