<?php

namespace App\Http\Controllers\Api\V1\Specialist;

use App\Actions\Deliveries\RecordDelivery;
use App\Http\Controllers\Controller;
use App\Http\Requests\FilterDeliveriesRequest;
use App\Http\Requests\RecordDeliveryRequest;
use App\Services\Deliveries\DeliveryScreens;
use Illuminate\Http\JsonResponse;

/**
 * Deliveries on the Specialist's phone, so a delivery can be recorded at
 * the counter as it arrives: the recorded ones, the items still waiting,
 * and Record Delivery itself, with the website's rules and words
 * (RecordDeliveryRequest, RecordDelivery, DeliveryScreens).
 */
class DeliveryController extends Controller
{
    /**
     * Recorded deliveries, newest first, searchable by SI #, DR # or Order #.
     */
    public function index(FilterDeliveriesRequest $request): JsonResponse
    {
        return response()->json(DeliveryScreens::recorded($request->search(), $request->dateFrom(), $request->dateTo()));
    }

    /**
     * Every item still waiting to arrive, grouped by item code, oldest order
     * first, and today's date for the form.
     */
    public function waiting(): JsonResponse
    {
        return response()->json([
            'groups' => DeliveryScreens::waiting(),
            'today' => now()->toDateString(),
        ]);
    }

    public function store(RecordDeliveryRequest $request, RecordDelivery $recordDelivery): JsonResponse
    {
        $delivery = $recordDelivery->handle(
            $request->user(),
            $request->deliveryDetails(),
            $request->receivedQuantities(),
            $request->splitsByCode(),
        );

        return response()->json(DeliveryScreens::recordedMessage($delivery), 201);
    }
}
