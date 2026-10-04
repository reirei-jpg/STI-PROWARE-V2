<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Orders\CancelOrderByStudent;
use App\Actions\Orders\PlaceOrder;
use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\Shop\OrderRow;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The student's orders on the phone app: place the order from the cart, My
 * Orders, one order, and cancelling while it is still Placed. Same rules as
 * the website (PlaceOrder, CancelOrderByStudent).
 */
class OrderController extends Controller
{
    /**
     * Orders not picked up yet first, newest first, 20 at a time.
     */
    public function index(Request $request): JsonResponse
    {
        return response()->json($request->user()->orders()
            ->with(['items', 'student'])
            ->orderByRaw("case when status in ('placed', 'ready') then 0 else 1 end")
            ->latest('id')
            ->paginate(20)
            ->through(fn (Order $order): array => OrderRow::forStudent($order)));
    }

    public function show(Request $request, Order $order): JsonResponse
    {
        abort_unless($order->user_id === $request->user()->id, 404);

        return response()->json(OrderRow::forStudent($order->load(['items', 'student'])));
    }

    /**
     * Place Order: the stock is taken now and held until pickup.
     */
    public function store(Request $request, PlaceOrder $placeOrder): JsonResponse
    {
        $order = $placeOrder->handle($request->user());

        return response()->json([
            'message' => "Order {$order->number} placed. Pick it up and pay in cash at the PROWARE office by {$order->pick_up_by->format('M j, Y')}.",
            'order' => OrderRow::forStudent($order->load(['items', 'student'])),
        ], 201);
    }

    public function cancel(Request $request, Order $order, CancelOrderByStudent $cancelOrder): JsonResponse
    {
        abort_unless($order->user_id === $request->user()->id, 404);

        $cancelOrder->handle($order, $request->user());

        return response()->json([
            'message' => "Order {$order->number} was cancelled.",
            'order' => OrderRow::forStudent($order->refresh()->load(['items', 'student'])),
        ]);
    }
}
