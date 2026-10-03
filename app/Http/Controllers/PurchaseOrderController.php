<?php

namespace App\Http\Controllers;

use App\Enums\DeliveryStatus;
use App\Enums\UserRole;
use App\Http\Requests\FilterPurchaseOrdersRequest;
use App\Models\Delivery;
use App\Models\DeliveryItem;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\StockMovement;
use App\Models\User;
use App\Notifications\PurchaseOrderUploaded;
use App\Services\EstorePo\EstorePoParser;
use App\Services\EstorePo\PendingPurchaseOrderScan;
use App\Services\EstorePo\ScannedPurchaseOrder;
use App\Services\EstorePo\ScannedPurchaseOrderItem;
use App\Services\EstorePo\UnreadablePurchaseOrderException;
use App\Services\Stock\LinkedItems;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The purchase orders the Specialist has uploaded from the eStore.
 */
class PurchaseOrderController extends Controller
{
    /**
     * List the saved purchase orders, newest Date Ordered first, optionally
     * limited to a Date Ordered range. The summary follows the same range.
     */
    public function index(FilterPurchaseOrdersRequest $request): Response
    {
        $search = $request->search();
        $category = $request->category();
        $status = $request->status();
        $sort = $request->sort();
        $dateFrom = $request->dateFrom();
        $dateTo = $request->dateTo();

        $filtered = PurchaseOrder::query()
            ->when($search, fn (Builder $query, string $orderNumber) => $query->whereLike('order_number', "%{$orderNumber}%"))
            ->when($category, fn (Builder $query, string $name) => $query->where('category', $name))
            ->when($status, fn (Builder $query, DeliveryStatus $chosen) => $query->where('delivery_status', $chosen))
            ->when($dateFrom, fn (Builder $query, string $date) => $query->whereDate('date_ordered', '>=', $date))
            ->when($dateTo, fn (Builder $query, string $date) => $query->whereDate('date_ordered', '<=', $date));

        $sorted = match ($sort) {
            // Orders still waiting come first, the oldest order at the top.
            'oldest_waiting' => (clone $filtered)
                ->orderByRaw('case when delivery_status in (?, ?) then 0 else 1 end', [DeliveryStatus::Awaiting->value, DeliveryStatus::PartiallyReceived->value])
                ->orderBy('date_ordered')
                ->orderBy('id'),
            'newest' => (clone $filtered)
                ->orderByDesc('date_ordered')
                ->orderByDesc('id'),
            // Default: the delivery expected soonest at the top; orders
            // without an expected date follow, newest first.
            default => (clone $filtered)
                ->orderByRaw('case when expected_delivery_date is null then 1 else 0 end')
                ->orderBy('expected_delivery_date')
                ->orderByDesc('date_ordered')
                ->orderByDesc('id'),
        };

        $purchaseOrders = $sorted
            ->with('uploader')
            ->withCount('items')
            ->paginate(20)
            ->withQueryString()
            ->through(fn (PurchaseOrder $purchaseOrder): array => [
                'id' => $purchaseOrder->id,
                'order_number' => $purchaseOrder->order_number,
                'ordered_by' => $purchaseOrder->ordered_by,
                'date_ordered' => $purchaseOrder->date_ordered->toDateString(),
                'category' => $purchaseOrder->category,
                'total_amount_centavos' => $purchaseOrder->total_amount_centavos,
                'items_count' => $purchaseOrder->items_count,
                'uploaded_by' => $purchaseOrder->uploader->name,
                'uploaded_at' => $purchaseOrder->created_at?->toIso8601String(),
                'delivery_status' => $purchaseOrder->delivery_status->value,
                'delivery_status_label' => $purchaseOrder->delivery_status->label(),
                'quantity_ordered_total' => $purchaseOrder->quantity_ordered_total,
                'quantity_received_total' => $purchaseOrder->quantity_received_total,
                'percent_received' => $purchaseOrder->percentReceived(),
                'expected_delivery_date' => $purchaseOrder->expected_delivery_date?->toDateString(),
                'expected_delivery_note' => $purchaseOrder->expected_delivery_note,
            ]);

        return Inertia::render('purchase-orders/index', [
            'purchaseOrders' => $purchaseOrders,
            'summary' => [
                'orders_count' => (clone $filtered)->count(),
                'total_qty_ordered' => (int) PurchaseOrderItem::query()
                    ->whereIn('purchase_order_id', (clone $filtered)->select('id'))
                    ->sum('quantity_ordered'),
                'total_amount_centavos' => (int) (clone $filtered)->sum('total_amount_centavos'),
            ],
            'filters' => [
                'search' => $search,
                'category' => $category,
                'status' => $status?->value,
                'sort' => $sort,
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
            ],
            'categories' => PurchaseOrder::query()
                ->whereNotNull('category')
                ->distinct()
                ->orderBy('category')
                ->pluck('category')
                ->all(),
            'openPurchaseOrderId' => $request->filled('view') ? $request->integer('view') : null,
            'today' => now()->toDateString(),
        ]);
    }

    /**
     * Save the purchase order the Specialist just scanned.
     */
    public function store(Request $request, EstorePoParser $parser, PendingPurchaseOrderScan $pendingScans): RedirectResponse
    {
        $pending = $pendingScans->get($request->session());

        if ($pending === null) {
            throw ValidationException::withMessages(['save' => 'There is no scanned file to save. Please scan the purchase order again.']);
        }

        try {
            $scan = $parser->parseFile($pendingScans->absolutePath($pending['path']));
        } catch (UnreadablePurchaseOrderException $exception) {
            $pendingScans->discard($request->session());

            throw ValidationException::withMessages(['save' => $exception->getMessage()]);
        }

        if ($scan->hasBlockingProblems()) {
            throw ValidationException::withMessages(['save' => 'This order can\'t be saved because some essential details could not be read. Check the problems marked "Must fix".']);
        }

        if ($scan->warnings !== [] && ! $request->boolean('warnings_checked')) {
            throw ValidationException::withMessages(['warnings_checked' => 'Tick the box to confirm you checked the warnings above.']);
        }

        $this->ensureNotAlreadyUploaded($scan);

        $documentPath = 'purchase-orders/'.basename($pending['path']);

        try {
            $purchaseOrder = DB::transaction(function () use ($request, $scan, $pending, $documentPath): PurchaseOrder {
                $purchaseOrder = PurchaseOrder::create([
                    'order_number' => $scan->orderNumber,
                    'school' => $scan->school,
                    'ordered_by' => $scan->orderedBy,
                    'uploaded_by' => $request->user()->id,
                    'date_ordered' => $scan->dateOrdered,
                    'time_ordered' => $scan->timeOrdered,
                    'category' => $scan->category,
                    'total_amount_centavos' => $scan->totalAmountCentavos,
                    'original_file_name' => $pending['file_name'],
                    'document_path' => $documentPath,
                ]);

                $purchaseOrder->items()->createMany(array_map(
                    fn (ScannedPurchaseOrderItem $item): array => [
                        'row_number' => $item->rowNumber,
                        'item_code' => (string) $item->itemCode,
                        'description' => $item->description,
                        'stock_on_hand' => $item->stockOnHand,
                        'quantity_ordered' => (int) $item->quantityOrdered,
                        'unit_price_centavos' => (int) $item->unitPriceCentavos,
                        'amount_centavos' => $item->amountCentavos ?? (int) $item->quantityOrdered * (int) $item->unitPriceCentavos,
                    ],
                    $scan->items,
                ));

                $purchaseOrder->refreshDeliveryProgress();

                return $purchaseOrder;
            });
        } catch (UniqueConstraintViolationException) {
            $this->ensureNotAlreadyUploaded($scan);

            throw ValidationException::withMessages(['save' => "Order #{$scan->orderNumber} was already uploaded."]);
        }

        $pendingScans->keep($request->session(), $pending, $documentPath);

        Notification::send(
            User::query()->where('role', UserRole::SchoolAdmin)->get(),
            new PurchaseOrderUploaded($purchaseOrder),
        );

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Purchase order saved.']);

        return to_route('purchase-orders.index');
    }

    /**
     * Every detail of one purchase order, for the details window on the list.
     */
    public function show(PurchaseOrder $purchaseOrder): JsonResponse
    {
        $purchaseOrder->load(['uploader', 'closer', 'items']);

        $deliveries = Delivery::query()
            ->with('recorder')
            ->whereHas('items.purchaseOrderItem', fn (Builder $query) => $query->where('purchase_order_id', $purchaseOrder->id))
            ->with(['items' => fn ($query) => $query
                ->whereHas('purchaseOrderItem', fn (Builder $item) => $item->where('purchase_order_id', $purchaseOrder->id))
                ->with(['purchaseOrderItem', 'stockMovements.variant.product'])])
            ->latest('received_on')
            ->latest('id')
            ->get();

        $linkedVariants = LinkedItems::variantsByCode($purchaseOrder->items->pluck('item_code')->all());

        return response()->json([
            'id' => $purchaseOrder->id,
            'order_number' => $purchaseOrder->order_number,
            'school' => $purchaseOrder->school,
            'ordered_by' => $purchaseOrder->ordered_by,
            'date_ordered' => $purchaseOrder->date_ordered->toDateString(),
            'time_ordered' => $purchaseOrder->time_ordered === null ? null : substr($purchaseOrder->time_ordered, 0, 5),
            'category' => $purchaseOrder->category,
            'total_amount_centavos' => $purchaseOrder->total_amount_centavos,
            'uploaded_by' => $purchaseOrder->uploader->name,
            'uploaded_at' => $purchaseOrder->created_at?->toIso8601String(),
            'delivery_status' => $purchaseOrder->delivery_status->value,
            'delivery_status_label' => $purchaseOrder->delivery_status->label(),
            'quantity_ordered_total' => $purchaseOrder->quantity_ordered_total,
            'quantity_received_total' => $purchaseOrder->quantity_received_total,
            'percent_received' => $purchaseOrder->percentReceived(),
            'expected_delivery_date' => $purchaseOrder->expected_delivery_date?->toDateString(),
            'expected_delivery_note' => $purchaseOrder->expected_delivery_note,
            'closed_reason' => $purchaseOrder->closed_reason,
            'closed_at' => $purchaseOrder->closed_at?->toIso8601String(),
            'closed_by' => $purchaseOrder->closer?->name,
            'items' => $purchaseOrder->items->map(fn (PurchaseOrderItem $item): array => [
                'row_number' => $item->row_number,
                'item_code' => $item->item_code,
                'description' => $item->description,
                'stock_on_hand' => $item->stock_on_hand,
                'quantity_ordered' => $item->quantity_ordered,
                'quantity_received' => $item->quantity_delivered,
                'quantity_remaining' => $item->quantityRemaining(),
                'unit_price_centavos' => $item->unit_price_centavos,
                'amount_centavos' => $item->amount_centavos,
                'stock_target' => $linkedVariants->has($item->item_code) ? LinkedItems::target($linkedVariants->get($item->item_code)) : null,
            ])->all(),
            'deliveries' => $deliveries->map(fn (Delivery $delivery): array => [
                'id' => $delivery->id,
                'received_on' => $delivery->received_on->toDateString(),
                'sales_invoice_number' => $delivery->sales_invoice_number,
                'delivery_receipt_number' => $delivery->delivery_receipt_number,
                'recorded_by' => $delivery->recorder->name,
                'items' => $delivery->items->map(fn (DeliveryItem $item): array => [
                    'item_code' => $item->purchaseOrderItem->item_code,
                    'description' => $item->purchaseOrderItem->description,
                    'quantity_received' => $item->quantity_received,
                    'added_to_stock' => array_values($item->stockMovements->map(fn (StockMovement $movement): array => [
                        'product_name' => $movement->variant->displayName(),
                        'units_received' => (int) $movement->units_received,
                        'unit_name' => (string) $movement->unit_name,
                        'pieces_per_unit' => (int) $movement->pieces_per_unit,
                        'pieces' => $movement->quantity,
                    ])->all()),
                ])->values()->all(),
            ])->all(),
        ]);
    }

    /**
     * The eStore's Order # identifies an order, so the same Order # cannot
     * be saved twice.
     */
    private function ensureNotAlreadyUploaded(ScannedPurchaseOrder $scan): void
    {
        $duplicate = PurchaseOrder::query()
            ->with('uploader')
            ->where('order_number', $scan->orderNumber)
            ->first();

        if ($duplicate !== null) {
            throw ValidationException::withMessages(['save' => sprintf(
                'Order #%s was already uploaded on %s by %s.',
                $scan->orderNumber,
                $duplicate->created_at?->format('M j, Y g:i A'),
                $duplicate->uploader->name,
            )]);
        }
    }
}
