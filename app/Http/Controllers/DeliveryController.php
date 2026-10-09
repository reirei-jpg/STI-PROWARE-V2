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
     * Received deliveries (newest first, searchable by SI #, DR # or
     * Order #) or the purchase orders still waiting for their delivery,
     * with the numbers at the top and one delivery's details when asked.
     */
    public function index(FilterDeliveriesRequest $request): Response
    {
        $show = $request->show();
        $waiting = $request->showsWaiting();

        return Inertia::render('deliveries/index', [
            'deliveries' => $waiting ? null : DeliveryScreens::recorded($request->search(), $request->dateFrom(), $request->dateTo(), $show),
            'waitingOrders' => $waiting ? DeliveryScreens::waitingOrders($request->search(), $show) : null,
            'summary' => DeliveryScreens::summary(),
            'details' => Inertia::optional(fn (): ?array => $request->filled('details') ? DeliveryScreens::details($request->integer('details')) : null),
            'filters' => [
                'show' => $show,
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
