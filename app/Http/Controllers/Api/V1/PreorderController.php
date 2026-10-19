<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Orders\PlaceOrder;
use App\Actions\Preorders\CancelPreorderByStudent;
use App\Actions\Preorders\OrderHeldPreorder;
use App\Actions\Preorders\PlacePreorder;
use App\Http\Controllers\Controller;
use App\Http\Requests\OrderHeldPreorderRequest;
use App\Http\Requests\PlacePreorderRequest;
use App\Models\Preorder;
use App\Models\Product;
use App\Services\Shop\OrderRow;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The student's preorders on the phone app (reservations, nothing to pay),
 * with the website's rules (PlacePreorderRequest, PlacePreorder,
 * CancelPreorderByStudent).
 */
class PreorderController extends Controller
{
    /**
     * Active preorders first, newest first, 20 at a time.
     */
    public function index(Request $request): JsonResponse
    {
        return response()->json(CancelPreorderByStudent::studentPage($request->user()));
    }

    public function store(PlacePreorderRequest $request, Product $product, PlacePreorder $placePreorder): JsonResponse
    {
        $preorders = $placePreorder->handleMany($request->user(), $product, $request->items());
        $rows = array_map(
            fn (Preorder $preorder): array => CancelPreorderByStudent::row($preorder->load(['product.mainPhoto', 'variant'])),
            $preorders,
        );

        return response()->json([
            'message' => PlacePreorder::messageForMany($preorders, $product),
            'preorder' => $rows[0],
            'preorders' => $rows,
        ], 201);
    }

    /**
     * Order Now on held pieces (as on the website).
     */
    public function order(OrderHeldPreorderRequest $request, Preorder $preorder, OrderHeldPreorder $orderHeldPreorder): JsonResponse
    {
        $order = $orderHeldPreorder->handle($request->user(), $preorder, $request->integer('quantity'), $request->section());

        return response()->json([
            'message' => PlaceOrder::message($order),
            'order' => OrderRow::forStudent($order->load(['items', 'student'])),
        ], 201);
    }

    public function destroy(Request $request, Preorder $preorder, CancelPreorderByStudent $cancelPreorder): JsonResponse
    {
        abort_unless($preorder->user_id === $request->user()->id, 404);

        $cancelPreorder->handle($preorder);

        return response()->json([
            'message' => CancelPreorderByStudent::message($preorder),
            'preorder' => CancelPreorderByStudent::row($preorder->refresh()->load(['product.mainPhoto', 'variant'])),
        ]);
    }
}
