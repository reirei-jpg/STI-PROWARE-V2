<?php

namespace App\Http\Controllers;

use App\Actions\Deliveries\RecordDelivery;
use App\Http\Requests\FilterDeliveriesRequest;
use App\Http\Requests\RecordDeliveryRequest;
use App\Services\Deliveries\DeliveryScreens;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Deliveries from Head Office: the Specialist records what arrived, and the
 * orders' progress follows. The lists and the "Delivery recorded" words are
 * in DeliveryScreens, shared with the Specialist's phone.
 */
class DeliveryController extends Controller
{
    /**
     * Recorded deliveries, newest first, searchable by SI #, DR # or Order #.
     */
    public function index(FilterDeliveriesRequest $request): Response
    {
        return Inertia::render('deliveries/index', [
            'deliveries' => DeliveryScreens::recorded($request->search(), $request->dateFrom(), $request->dateTo()),
            'filters' => [
                'search' => $request->search(),
                'date_from' => $request->dateFrom(),
                'date_to' => $request->dateTo(),
            ],
        ]);
    }

    /**
     * The Record Delivery form: every item still waiting, grouped by item
     * code, oldest order first within each code.
     */
    public function create(): Response
    {
        return Inertia::render('deliveries/create', [
            'groups' => DeliveryScreens::waiting(),
            'today' => now()->toDateString(),
        ]);
    }

    public function store(RecordDeliveryRequest $request, RecordDelivery $recordDelivery): RedirectResponse
    {
        $delivery = $recordDelivery->handle(
            $request->user(),
            $request->deliveryDetails(),
            $request->receivedQuantities(),
            $request->splitsByCode(),
        );

        Inertia::flash('toast', DeliveryScreens::recordedMessage($delivery));

        return to_route('deliveries.index');
    }
}
