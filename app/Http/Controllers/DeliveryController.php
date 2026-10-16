<?php

namespace App\Http\Controllers;

use App\Actions\Deliveries\RecordDelivery;
use App\Http\Requests\FilterDeliveriesRequest;
use App\Http\Requests\RecordDeliveryRequest;
use App\Services\Deliveries\DeliveryScreens;
use App\Services\Deliveries\FollowUp;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
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
     * Record Delivery starts with "Which order arrived?": the purchase
     * orders still waiting, the oldest first, searchable by Order #. Each
     * opens the Record Delivery popup with only that order's items.
     */
    public function create(Request $request): Response
    {
        $search = $request->validate(['search' => ['nullable', 'string', 'max:40']])['search'] ?? null;
        $search = is_string($search) && trim($search) !== '' ? trim($search) : null;

        return Inertia::render('deliveries/create', [
            'orders' => DeliveryScreens::waitingOrders($search),
            'search' => $search,
            'followUpDays' => FollowUp::days(),
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

        // Recorded from a purchase order's popup: stay on that page.
        return $request->boolean('stay_on_page') ? back() : to_route('deliveries.index');
    }
}
