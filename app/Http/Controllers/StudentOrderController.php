<?php

namespace App\Http\Controllers;

use App\Actions\Orders\CancelOrderByStudent;
use App\Actions\Orders\PlaceOrder;
use App\Http\Requests\PlaceOrderRequest;
use App\Models\Order;
use App\Services\Shop\OrderRow;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * A student's orders: placing the order from the cart, My Orders, and
 * cancelling an order the PROWARE office has not prepared yet.
 */
class StudentOrderController extends Controller
{
    /**
     * My Orders: orders not picked up yet first, newest first.
     */
    public function index(Request $request): Response
    {
        return Inertia::render('storefront/my-orders', [
            'orders' => OrderRow::studentPage($request->user()),
        ]);
    }

    /**
     * Place Order: its items are held until the Specialist releases them.
     */
    public function store(PlaceOrderRequest $request, PlaceOrder $placeOrder): RedirectResponse
    {
        $order = $placeOrder->handle($request->user(), $request->section());

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => PlaceOrder::message($order),
        ]);

        return to_route('my-orders.index');
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
