<?php

namespace App\Http\Controllers;

use App\Actions\Orders\HandleOrderBySpecialist;
use App\Http\Requests\ReleaseOrderRequest;
use App\Models\Order;
use App\Services\Preorders\PreorderPayment;
use App\Services\Shop\IssuanceSlip;
use App\Services\Shop\SpecialistOrders;
use Closure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The Specialist's Orders page: buyers' orders waiting for payment, and
 * those released or cancelled. A buyer pays at the cashier and shows the
 * receipt and the order's issuance slip; the Specialist scans (or types)
 * its code, checks it, and releases the items (HandleOrderBySpecialist,
 * shared with the phone app). Only the buyer can cancel an order.
 */
class OrderController extends Controller
{
    /**
     * Orders by status (Waiting for payment by default), with a search by
     * order number or buyer name. The open order's popup asks for it again
     * after each step, so it stays open when the order moves tabs.
     */
    public function index(Request $request): Response
    {
        $filters = SpecialistOrders::filters($request);

        return Inertia::render('orders/index', [
            'orders' => SpecialistOrders::page($filters['show'], $filters['search']),
            'filters' => $filters,
            'counts' => SpecialistOrders::counts(),
            'viewing' => Inertia::optional(fn (): ?array => SpecialistOrders::one($request->integer('viewing'))),
        ]);
    }

    /**
     * A scanned issuance slip (or a typed order number): the order, its slip
     * and the student's other open orders, or that it is not a PROWARE slip.
     */
    public function slip(Request $request): Response
    {
        $code = trim((string) ($request->validate(['code' => ['nullable', 'string', 'max:120']])['code'] ?? ''));

        return Inertia::render('orders/slip', [
            'code' => $code,
            'result' => $code === '' ? null : SpecialistOrders::bySlip($code),
            // A preorder slip (PR-0001), paid at the cashier.
            'preorderResult' => $code === '' ? null : PreorderPayment::bySlip($code),
        ]);
    }

    /**
     * The issuance slip alone, to print for the signatures.
     */
    public function printSlip(Order $order): Response
    {
        return Inertia::render('print/issuance-slip', [
            'slip' => IssuanceSlip::of($order->load(['items', 'student', 'handler'])),
        ]);
    }

    public function release(ReleaseOrderRequest $request, Order $order, HandleOrderBySpecialist $handle): RedirectResponse
    {
        return $this->respond(fn (): string => $handle->release($order, $request->user()));
    }

    /**
     * Show what happened, or why it was refused, as a toast.
     *
     * @param  Closure(): string  $step
     */
    private function respond(Closure $step): RedirectResponse
    {
        try {
            Inertia::flash('toast', ['type' => 'success', 'message' => $step()]);
        } catch (ValidationException $refused) {
            Inertia::flash('toast', ['type' => 'error', 'message' => $refused->validator->errors()->first('order')]);
        }

        return back();
    }
}
