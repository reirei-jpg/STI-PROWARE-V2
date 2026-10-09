<?php

namespace App\Http\Controllers;

use App\Actions\Orders\HandleOrderBySpecialist;
use App\Http\Requests\CancelOrderRequest;
use App\Http\Requests\ReleaseOrderRequest;
use App\Models\Order;
use App\Models\Setting;
use App\Models\User;
use App\Services\Shop\IssuanceSlip;
use App\Services\Shop\OrderRules;
use App\Services\Shop\SpecialistOrders;
use Closure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The Specialist's Orders page: students' orders to prepare and hand over.
 * A student shows the order's issuance slip; the Specialist scans (or
 * types) its code, checks it, and releases the items once paid. The steps
 * (Ready for pickup, Release, undo release, Cancel) are in
 * HandleOrderBySpecialist, shared with the phone app.
 */
class OrderController extends Controller
{
    /**
     * Orders by status (New orders by default), with a search by order
     * number or student name; how long orders hold their items; and the
     * students who cannot order now because their orders kept expiring.
     */
    public function index(Request $request): Response
    {
        $filters = SpecialistOrders::filters($request);

        return Inertia::render('orders/index', [
            'orders' => SpecialistOrders::page($filters['show'], $filters['search']),
            'filters' => $filters,
            'counts' => SpecialistOrders::counts(),
            'holdDays' => OrderRules::holdDays(),
            'pausedStudents' => OrderRules::pausedStudents(),
        ]);
    }

    /**
     * A scanned issuance slip (or a typed order number): the order, its slip
     * and the student's other open orders, or that it is not a PROWARE slip.
     */
    public function slip(Request $request): Response
    {
        $code = trim((string) $request->validate(['code' => ['nullable', 'string', 'max:120']])['code']);

        return Inertia::render('orders/slip', [
            'code' => $code,
            'result' => $code === '' ? null : SpecialistOrders::bySlip($code),
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

    public function ready(Request $request, Order $order, HandleOrderBySpecialist $handle): RedirectResponse
    {
        return $this->respond(fn (): string => $handle->ready($order, $request->user()));
    }

    public function release(ReleaseOrderRequest $request, Order $order, HandleOrderBySpecialist $handle): RedirectResponse
    {
        return $this->respond(fn (): string => $handle->release($order, $request->user()));
    }

    public function undoRelease(Request $request, Order $order, HandleOrderBySpecialist $handle): RedirectResponse
    {
        return $this->respond(fn (): string => $handle->undoRelease($order, $request->user()));
    }

    public function cancel(CancelOrderRequest $request, Order $order, HandleOrderBySpecialist $handle): RedirectResponse
    {
        return $this->respond(fn (): string => $handle->cancel($order, $request->user(), $request->string('reason')->toString()));
    }

    /**
     * How many days new orders hold their items (1 to 3).
     */
    public function holdDays(Request $request): RedirectResponse
    {
        $days = $request->validate(
            ['hold_days' => ['required', 'integer', 'between:'.OrderRules::MIN_HOLD_DAYS.','.OrderRules::MAX_HOLD_DAYS]],
            ['hold_days.between' => 'Choose 1, 2 or 3 days.', 'hold_days.required' => 'Choose 1, 2 or 3 days.'],
        )['hold_days'];

        Setting::put(Setting::ORDER_HOLD_DAYS, (int) $days);

        return $this->respond(fn (): string => 'New orders now hold their items for '.$days.' '.((int) $days === 1 ? 'day' : 'days').'. Orders already placed keep their pick-up date.');
    }

    /**
     * Let a student whose orders kept expiring order again.
     */
    public function liftPause(User $student): RedirectResponse
    {
        abort_unless($student->isStudent(), 404);

        OrderRules::liftPause($student);

        return $this->respond(fn (): string => "{$student->name} can order again.");
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
