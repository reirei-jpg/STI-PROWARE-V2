<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\User;
use App\Notifications\PurchaseOrderUploaded;
use App\Services\EstorePo\EstorePoParser;
use App\Services\EstorePo\PendingPurchaseOrderScan;
use App\Services\EstorePo\ScannedPurchaseOrder;
use App\Services\EstorePo\ScannedPurchaseOrderItem;
use App\Services\EstorePo\UnreadablePurchaseOrderException;
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
     * List the saved purchase orders, newest upload first.
     */
    public function index(Request $request): Response
    {
        $purchaseOrders = PurchaseOrder::query()
            ->with('uploader')
            ->withCount('items')
            ->latest()
            ->latest('id')
            ->paginate(20)
            ->through(fn (PurchaseOrder $purchaseOrder): array => [
                'id' => $purchaseOrder->id,
                'date_ordered' => $purchaseOrder->date_ordered->toDateString(),
                'category' => $purchaseOrder->category,
                'total_amount_centavos' => $purchaseOrder->total_amount_centavos,
                'items_count' => $purchaseOrder->items_count,
                'uploaded_by' => $purchaseOrder->uploader->name,
                'uploaded_at' => $purchaseOrder->created_at?->toIso8601String(),
            ]);

        return Inertia::render('purchase-orders/index', [
            'purchaseOrders' => $purchaseOrders,
            'summary' => [
                'orders_count' => PurchaseOrder::query()->count(),
                'total_qty_ordered' => (int) PurchaseOrderItem::query()->sum('quantity_ordered'),
                'total_amount_centavos' => (int) PurchaseOrder::query()->sum('total_amount_centavos'),
            ],
            'openPurchaseOrderId' => $request->filled('view') ? $request->integer('view') : null,
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
                    'uploaded_by' => $request->user()->id,
                    'date_ordered' => $scan->dateOrdered,
                    'time_ordered' => $scan->timeOrdered,
                    'category' => $scan->category,
                    'total_amount_centavos' => $scan->totalAmountCentavos,
                    'original_file_name' => $pending['file_name'],
                    'document_path' => $documentPath,
                    'fingerprint' => $scan->fingerprint(),
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

                return $purchaseOrder;
            });
        } catch (UniqueConstraintViolationException) {
            $this->ensureNotAlreadyUploaded($scan);

            throw ValidationException::withMessages(['save' => 'This order was already uploaded.']);
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
        $purchaseOrder->load(['uploader', 'items']);

        return response()->json([
            'id' => $purchaseOrder->id,
            'date_ordered' => $purchaseOrder->date_ordered->toDateString(),
            'time_ordered' => $purchaseOrder->time_ordered === null ? null : substr($purchaseOrder->time_ordered, 0, 5),
            'category' => $purchaseOrder->category,
            'total_amount_centavos' => $purchaseOrder->total_amount_centavos,
            'uploaded_by' => $purchaseOrder->uploader->name,
            'uploaded_at' => $purchaseOrder->created_at?->toIso8601String(),
            'items' => $purchaseOrder->items->map(fn (PurchaseOrderItem $item): array => [
                'row_number' => $item->row_number,
                'item_code' => $item->item_code,
                'description' => $item->description,
                'stock_on_hand' => $item->stock_on_hand,
                'quantity_ordered' => $item->quantity_ordered,
                'unit_price_centavos' => $item->unit_price_centavos,
                'amount_centavos' => $item->amount_centavos,
            ])->all(),
        ]);
    }

    private function ensureNotAlreadyUploaded(ScannedPurchaseOrder $scan): void
    {
        $duplicate = PurchaseOrder::query()
            ->with('uploader')
            ->where('fingerprint', $scan->fingerprint())
            ->first();

        if ($duplicate !== null) {
            throw ValidationException::withMessages(['save' => sprintf(
                'This order was already uploaded on %s by %s.',
                $duplicate->created_at?->format('M j, Y g:i A'),
                $duplicate->uploader->name,
            )]);
        }
    }
}
