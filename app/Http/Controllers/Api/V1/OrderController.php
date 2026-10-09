<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Orders\CancelOrderByStudent;
use App\Actions\Orders\PlaceOrder;
use App\Http\Controllers\Controller;
use App\Http\Requests\PlaceOrderRequest;
use App\Models\Order;
use App\Services\Shop\IssuanceSlip;
use App\Services\Shop\OrderRow;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The student's orders on the phone app: place the order from the cart, My
 * Orders, one order, its issuance slip, and cancelling while it is still
 * Placed. Same rules as
 * the website (PlaceOrder, CancelOrderByStudent).
 */
class OrderController extends Controller
{
    /**
     * Orders not picked up yet first, newest first, 20 at a time.
     */
    public function index(Request $request): JsonResponse
    {
        return response()->json(OrderRow::studentPage($request->user()));
    }

    public function show(Request $request, Order $order): JsonResponse
    {
        abort_unless($order->user_id === $request->user()->id, 404);

        return response()->json(OrderRow::forStudent($order->load(['items', 'student'])));
    }

    /**
     * The order's issuance slip with its QR, to show the Specialist.
     */
    public function slip(Request $request, Order $order): JsonResponse
    {
        abort_unless($order->user_id === $request->user()->id, 404);

        return response()->json(IssuanceSlip::of($order->load(['items', 'student', 'handler'])));
    }

    /**
     * Place Order: its items are held until the Specialist releases them.
     */
    public function store(PlaceOrderRequest $request, PlaceOrder $placeOrder): JsonResponse
    {
        $order = $placeOrder->handle($request->user(), $request->section());

        return response()->json([
            'message' => PlaceOrder::message($order),
            'order' => OrderRow::forStudent($order->load(['items', 'student'])),
        ], 201);
    }

    public function cancel(Request $request, Order $order, CancelOrderByStudent $cancelOrder): JsonResponse
    {
        abort_unless($order->user_id === $request->user()->id, 404);

        $cancelOrder->handle($order, $request->user());

        return response()->json([
            'message' => CancelOrderByStudent::message($order),
            'order' => OrderRow::forStudent($order->refresh()->load(['items', 'student'])),
        ]);
    }
}
