<?php

namespace App\Http\Controllers;

use App\Actions\Deliveries\RecordDelivery;
use App\Enums\DeliveryStatus;
use App\Http\Requests\FilterDeliveriesRequest;
use App\Http\Requests\RecordDeliveryRequest;
use App\Models\Delivery;
use App\Models\DeliveryItem;
use App\Models\PurchaseOrderItem;
use App\Models\StockMovement;
use App\Services\Stock\LinkedItems;
use App\Services\Stock\Units;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Collection;
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
            ->withCount(['items as items_not_in_stock_count' => fn (Builder $query) => $query->whereDoesntHave('stockMovements')])
            ->addSelect(['pieces_added_to_stock' => StockMovement::query()
                ->selectRaw('coalesce(sum(stock_movements.quantity), 0)')
                ->join('delivery_items', 'delivery_items.id', '=', 'stock_movements.delivery_item_id')
                ->whereColumn('delivery_items.delivery_id', 'deliveries.id')])
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
                'recorded_at' => $delivery->created_at?->toIso8601String(),
                'orders' => array_values($delivery->items
                    ->map(fn (DeliveryItem $item): array => [
                        'id' => $item->purchaseOrderItem->purchaseOrder->id,
                        'order_number' => $item->purchaseOrderItem->purchaseOrder->order_number,
                    ])
                    ->unique('id')
                    ->all()),
                'pieces_added_to_stock' => (int) $delivery->getAttribute('pieces_added_to_stock'),
                'items_not_in_stock' => (int) $delivery->getAttribute('items_not_in_stock_count'),
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

        $linkedVariants = LinkedItems::variantsByCode($waiting->pluck('item_code')->all());

        $groups = $waiting
            ->groupBy('item_code')
            ->map(fn ($items, string $itemCode): array => [
                'item_code' => $itemCode,
                'description' => $items->first()->description,
                'stock_target' => $linkedVariants->has($itemCode) ? LinkedItems::target($linkedVariants->get($itemCode)) : null,
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
            $request->splitsByCode(),
        );

        $addedToStock = StockMovement::query()
            ->with('variant.product')
            ->whereIn('delivery_item_id', $delivery->items()->select('id'))
            ->orderBy('id')
            ->get()
            ->groupBy('product_variant_id')
            ->map(function (Collection $movements): string {
                $first = $movements->firstOrFail();

                return $first->variant->displayName().' — '.Units::conversion(
                    (int) $movements->sum('units_received'),
                    (string) $first->unit_name,
                    (int) $first->pieces_per_unit,
                );
            })
            ->values();

        $notLinked = $delivery->items()
            ->with('purchaseOrderItem')
            ->whereDoesntHave('stockMovements')
            ->get()
            ->groupBy(fn (DeliveryItem $item): string => $item->purchaseOrderItem->item_code)
            ->map(fn (Collection $items, string $itemCode): string => $itemCode.' ('.number_format((int) $items->sum('quantity_received')).' as ordered on the eStore)')
            ->values();

        $message = 'Delivery recorded.';

        if ($addedToStock->isNotEmpty()) {
            $message .= ' Added to stock: '.$this->listed($addedToStock->all()).'.';
        }

        if ($notLinked->isNotEmpty()) {
            $message .= $notLinked->count() === 1
                ? ' Not added to stock yet, because it is not linked to a product: '.$this->listed($notLinked->all()).'. Link it in Products › Items to Link.'
                : ' Not added to stock yet, because they are not linked to a product: '.$this->listed($notLinked->all()).'. Link them in Products › Items to Link.';
        }

        Inertia::flash('toast', [
            'type' => $notLinked->isNotEmpty() ? 'warning' : 'success',
            'message' => $message,
        ]);

        return to_route('deliveries.index');
    }

    /**
     * The first three lines joined with "; ", then how many more there are.
     *
     * @param  array<int, string>  $lines
     */
    private function listed(array $lines): string
    {
        $shown = implode('; ', array_slice($lines, 0, 3));

        return count($lines) > 3
            ? $shown.'; and '.(count($lines) - 3).' more'
            : $shown;
    }
}
