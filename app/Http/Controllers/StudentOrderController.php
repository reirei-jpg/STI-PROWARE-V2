<?php

namespace App\Http\Controllers;

use App\Actions\Orders\CancelOrderByStudent;
use App\Actions\Orders\PlaceOrder;
use App\Http\Requests\PlaceOrderRequest;
use App\Models\Order;
use App\Services\Shop\IssuanceSlip;
use App\Services\Shop\OrderRow;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * A student's orders: placing the order from the cart, My Orders, each
 * order's issuance slip (to show at the PROWARE office), and cancelling an
 * order the PROWARE office has not prepared yet.
 */
class StudentOrderController extends Controller
{
    /**
     * My Orders, one short row per order: Waiting (not released yet) by
     * default, or Past.
     */
    public function index(Request $request): Response
    {
        $show = OrderRow::studentShow($request);

        return Inertia::render('storefront/my-orders', [
            'show' => $show,
            'counts' => OrderRow::studentCounts($request->user()),
            'orders' => OrderRow::studentPage($request->user(), $show),
        ]);
    }

    /**
     * The order's own page: its issuance slip with the QR to show the
     * Specialist, and Cancel while the office has not prepared it yet.
     */
    public function slip(Request $request, Order $order): Response
    {
        abort_unless($order->user_id === $request->user()->id, 404);

        return Inertia::render('storefront/issuance-slip', [
            'slip' => IssuanceSlip::of($order->load(['items', 'student', 'handler'])),
            'canCancel' => CancelOrderByStudent::refusal($order) === null,
        ]);
    }

    /**
     * The issuance slip alone, to print.
     */
    public function printSlip(Request $request, Order $order): Response
    {
        abort_unless($order->user_id === $request->user()->id, 404);

        return Inertia::render('print/issuance-slip', [
            'slip' => IssuanceSlip::of($order->load(['items', 'student', 'handler'])),
        ]);
    }

    /**
     * Place Order: its items are held until the Specialist releases them.
     * The student lands on the new order's issuance slip.
     */
    public function store(PlaceOrderRequest $request, PlaceOrder $placeOrder): RedirectResponse
    {
        $order = $placeOrder->handle($request->user(), $request->section());

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => PlaceOrder::message($order),
        ]);

        return to_route('my-orders.slip', $order);
    }

    /**
     * The student cancels while the order is still Placed; once the office
     * has prepared it, they are asked to talk to the office.
     */
    public function cancel(Request $request, Order $order, CancelOrderByStudent $cancelOrder): RedirectResponse
    {
        abort_unless($order->user_id === $request->user()->id, 404);

        $refusal = CancelOrderByStudent::refusal($order);

        if ($refusal !== null) {
            Inertia::flash('toast', ['type' => 'error', 'message' => $refusal]);

            return back();
        }

        $cancelOrder->handle($order, $request->user());

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => CancelOrderByStudent::message($order),
        ]);

        return back();
    }
}
