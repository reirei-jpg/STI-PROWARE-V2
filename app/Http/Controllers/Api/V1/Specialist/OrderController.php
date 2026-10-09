<?php

namespace App\Http\Controllers\Api\V1\Specialist;

use App\Actions\Orders\HandleOrderBySpecialist;
use App\Http\Controllers\Controller;
use App\Http\Requests\CancelOrderRequest;
use App\Http\Requests\ReleaseOrderRequest;
use App\Models\Order;
use App\Services\Shop\SpecialistOrders;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Students' orders on the Specialist's phone, with the website's list and
 * steps (SpecialistOrders, HandleOrderBySpecialist). Every step answers
 * with what happened and the order as it is now; a refusal is a 422 in
 * words.
 */
class OrderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = SpecialistOrders::filters($request);

        return response()->json([
            ...SpecialistOrders::page($filters['show'], $filters['search'])->toArray(),
            'counts' => SpecialistOrders::counts(),
        ]);
    }

    public function show(Order $order): JsonResponse
    {
        return response()->json(self::row($order));
    }

    /**
     * The order a scanned issuance slip (or a typed order number) is for.
     */
    public function slip(string $code): JsonResponse
    {
        $slip = SpecialistOrders::bySlip($code);

        return $slip === null
            ? response()->json(['message' => 'This is not a PROWARE issuance slip.'], 404)
            : response()->json($slip);
    }

    public function ready(Request $request, Order $order, HandleOrderBySpecialist $handle): JsonResponse
    {
        return self::done($handle->ready($order, $request->user()), $order);
    }

    public function release(ReleaseOrderRequest $request, Order $order, HandleOrderBySpecialist $handle): JsonResponse
    {
        return self::done($handle->release($order, $request->user()), $order);
    }

    public function undoRelease(Request $request, Order $order, HandleOrderBySpecialist $handle): JsonResponse
    {
        return self::done($handle->undoRelease($order, $request->user()), $order);
    }

    public function cancel(CancelOrderRequest $request, Order $order, HandleOrderBySpecialist $handle): JsonResponse
    {
        return self::done($handle->cancel($order, $request->user(), $request->string('reason')->toString()), $order);
    }

    private static function done(string $message, Order $order): JsonResponse
    {
        return response()->json(['message' => $message, 'order' => self::row($order->refresh())]);
    }

    /**
     * @return array<string, mixed>
     */
    private static function row(Order $order): array
    {
        return SpecialistOrders::row($order->load(['items', 'student', 'handler']));
    }
}
