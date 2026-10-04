<?php

namespace App\Http\Controllers;

use App\Actions\Orders\CancelOrderByStudent;
use App\Actions\Orders\PlaceOrder;
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
        $orders = $request->user()->orders()
            ->with(['items', 'student'])
            ->orderByRaw("case when status in ('placed', 'ready') then 0 else 1 end")
            ->latest('id')
            ->paginate(20)
            ->withQueryString()
            ->through(fn (Order $order): array => OrderRow::forStudent($order));

        return Inertia::render('storefront/my-orders', [
            'orders' => $orders,
        ]);
    }

    /**
     * Place Order: the stock is taken now and held until pickup.
     */
    public function store(Request $request, PlaceOrder $placeOrder): RedirectResponse
    {
        $order = $placeOrder->handle($request->user());

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => "Order {$order->number} placed. Pick it up and pay in cash at the PROWARE office by {$order->pick_up_by->format('M j, Y')}.",
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
            'message' => "Order {$order->number} was cancelled.",
        ]);

        return back();
    }
}
