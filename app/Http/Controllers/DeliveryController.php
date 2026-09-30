<?php

namespace App\Http\Controllers;

use App\Actions\Deliveries\RecordDelivery;
use App\Enums\DeliveryStatus;
use App\Http\Requests\FilterDeliveriesRequest;
use App\Http\Requests\RecordDeliveryRequest;
use App\Models\Delivery;
use App\Models\DeliveryItem;
use App\Models\PurchaseOrderItem;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Deliveries from Head Office: the Specialist records what arrived, and the
 * orders' progress follows.
 */
class DeliveryController extends Controller
{
    /**
     * Recorded deliveries, newest first, searchable by SI #, DR # or Order #.
     */
    public function index(FilterDeliveriesRequest $request): Response
    {
        $search = $request->search();
        $dateFrom = $request->dateFrom();
        $dateTo = $request->dateTo();

        $deliveries = Delivery::query()
            ->with(['recorder', 'items.purchaseOrderItem.purchaseOrder'])
            ->withSum('items', 'quantity_received')
            ->when($search, fn (Builder $query, string $term) => $query->where(
                fn (Builder $inner) => $inner
                    ->whereLike('sales_invoice_number', "%{$term}%")
                    ->orWhereLike('delivery_receipt_number', "%{$term}%")
                    ->orWhereHas('items.purchaseOrderItem.purchaseOrder', fn (Builder $order) => $order->whereLike('order_number', "%{$term}%")),
            ))
            ->when($dateFrom, fn (Builder $query, string $date) => $query->whereDate('received_on', '>=', $date))
            ->when($dateTo, fn (Builder $query, string $date) => $query->whereDate('received_on', '<=', $date))
            ->latest('received_on')
            ->latest('id')
            ->paginate(20)
            ->withQueryString()
            ->through(fn (Delivery $delivery): array => [
                'id' => $delivery->id,
                'received_on' => $delivery->received_on->toDateString(),
                'sales_invoice_number' => $delivery->sales_invoice_number,
                'delivery_receipt_number' => $delivery->delivery_receipt_number,
                'note' => $delivery->note,
                'recorded_by' => $delivery->recorder->name,
                'quantity_received' => (int) $delivery->getAttribute('items_sum_quantity_received'),
                'order_numbers' => $delivery->items
                    ->map(fn (DeliveryItem $item): ?string => $item->purchaseOrderItem->purchaseOrder->order_number)
                    ->filter()
                    ->unique()
                    ->values()
                    ->all(),
            ]);

        return Inertia::render('deliveries/index', [
            'deliveries' => $deliveries,
            'filters' => [
                'search' => $search,
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
            ],
        ]);
    }

    /**
     * The Record Delivery form: every item still waiting, grouped by item
     * code, oldest order first within each code.
     */
    public function create(): Response
    {
        $waiting = PurchaseOrderItem::query()
            ->select('purchase_order_items.*')
            ->join('purchase_orders', 'purchase_orders.id', '=', 'purchase_order_items.purchase_order_id')
            ->whereIn('purchase_orders.delivery_status', [DeliveryStatus::Awaiting, DeliveryStatus::PartiallyReceived])
            ->whereColumn('purchase_order_items.quantity_delivered', '<', 'purchase_order_items.quantity_ordered')
            ->orderBy('purchase_order_items.item_code')
            ->orderBy('purchase_orders.date_ordered')
            ->orderBy('purchase_orders.id')
            ->with('purchaseOrder')
            ->get();

        $groups = $waiting
            ->groupBy('item_code')
            ->map(fn ($items, string $itemCode): array => [
                'item_code' => $itemCode,
                'description' => $items->first()->description,
                'rows' => $items->map(fn (PurchaseOrderItem $item): array => [
                    'purchase_order_item_id' => $item->id,
                    'order_number' => $item->purchaseOrder->order_number,
                    'date_ordered' => $item->purchaseOrder->date_ordered->toDateString(),
                    'expected_delivery_date' => $item->purchaseOrder->expected_delivery_date?->toDateString(),
                    'quantity_ordered' => $item->quantity_ordered,
                    'quantity_received' => $item->quantity_delivered,
                    'quantity_remaining' => $item->quantityRemaining(),
                ])->values()->all(),
            ])
            ->values()
            ->all();

        return Inertia::render('deliveries/create', [
            'groups' => $groups,
            'today' => now()->toDateString(),
        ]);
    }

    public function store(RecordDeliveryRequest $request, RecordDelivery $recordDelivery): RedirectResponse
    {
        $delivery = $recordDelivery->handle(
            $request->user(),
            $request->deliveryDetails(),
            $request->receivedQuantities(),
        );

        $total = (int) $delivery->items()->sum('quantity_received');

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => "Delivery recorded: {$total} received.",
        ]);

        return to_route('deliveries.index');
    }
}
