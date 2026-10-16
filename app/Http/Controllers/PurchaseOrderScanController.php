<?php

namespace App\Http\Controllers;

use App\Enums\DeliveryStatus;
use App\Http\Requests\ScanEstorePoRequest;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Services\EstorePo\EstorePoParser;
use App\Services\EstorePo\PendingPurchaseOrderScan;
use App\Services\EstorePo\ScannedPurchaseOrder;
use App\Services\EstorePo\ScannedPurchaseOrderItem;
use App\Services\EstorePo\UnreadablePurchaseOrderException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Lets the PROWARE Specialist paste (or upload) an eStore order and review
 * what the scanner read from it before saving.
 */
class PurchaseOrderScanController extends Controller
{
    /**
     * Show the upload form and, when a file was just scanned, its result.
     */
    public function create(Request $request, EstorePoParser $parser, PendingPurchaseOrderScan $pendingScans): Response
    {
        $pending = $pendingScans->get($request->session());
        $scan = null;

        if ($pending !== null) {
            try {
                $scan = $parser->parseFile($pendingScans->absolutePath($pending['path']));
            } catch (UnreadablePurchaseOrderException) {
                $pendingScans->discard($request->session());
                $pending = null;
            }
        }

        $duplicate = $scan?->orderNumber === null ? null : PurchaseOrder::query()
            ->with('uploader')
            ->where('order_number', $scan->orderNumber)
            ->first();

        return Inertia::render('purchase-orders/scan', [
            'scan' => $scan?->toArray(),
            'fileName' => $pending['file_name'] ?? null,
            'duplicate' => $duplicate === null ? null : [
                'uploaded_at' => $duplicate->created_at?->toIso8601String(),
                'uploaded_by' => $duplicate->uploader->name,
            ],
            'alreadyWaiting' => $scan === null || $duplicate !== null ? [] : $this->alreadyWaiting($scan),
        ]);
    }

    /**
     * Items of the scanned order still waiting to arrive on another order,
     * e.g. ordered again before the first order came. Ordering more can be
     * on purpose, so it is only pointed out.
     *
     * @return list<array{item_code: string, description: string, order_number: string|null, remaining: int}>
     */
    private function alreadyWaiting(ScannedPurchaseOrder $scan): array
    {
        $codes = array_values(array_unique(array_filter(array_map(
            fn (ScannedPurchaseOrderItem $item): ?string => $item->itemCode,
            $scan->items,
        ))));

        if ($codes === []) {
            return [];
        }

        return array_values(PurchaseOrderItem::query()
            ->select('purchase_order_items.*')
            ->join('purchase_orders', 'purchase_orders.id', '=', 'purchase_order_items.purchase_order_id')
            ->whereIn('purchase_orders.delivery_status', [DeliveryStatus::Awaiting, DeliveryStatus::PartiallyReceived])
            ->whereColumn('purchase_order_items.quantity_delivered', '<', 'purchase_order_items.quantity_ordered')
            ->whereIn('purchase_order_items.item_code', $codes)
            ->orderBy('purchase_orders.date_ordered')
            ->orderBy('purchase_order_items.id')
            ->with('purchaseOrder')
            ->get()
            ->map(fn (PurchaseOrderItem $item): array => [
                'item_code' => $item->item_code,
                'description' => $item->description,
                'order_number' => $item->purchaseOrder->order_number,
                'remaining' => $item->quantityRemaining(),
            ])
            ->all());
    }

    /**
     * Scan the pasted order details email (or the uploaded file) and keep it
     * until the Specialist saves or discards it.
     */
    public function store(ScanEstorePoRequest $request, EstorePoParser $parser, PendingPurchaseOrderScan $pendingScans): RedirectResponse
    {
        $pendingScans->discard($request->session());

        $text = $request->pastedText();

        if ($text !== null) {
            try {
                $parser->parseText($text);
            } catch (UnreadablePurchaseOrderException $exception) {
                throw ValidationException::withMessages(['email_text' => $exception->getMessage()]);
            }

            $pendingScans->putText($request->session(), $text);

            return to_route('purchase-orders.scan');
        }

        $document = $request->file('document');

        try {
            $parser->parseFile($document->getRealPath());
        } catch (UnreadablePurchaseOrderException $exception) {
            throw ValidationException::withMessages(['document' => $exception->getMessage()]);
        }

        $pendingScans->put($request->session(), $document);

        return to_route('purchase-orders.scan');
    }

    /**
     * Throw away the scanned file without saving it.
     */
    public function destroy(Request $request, PendingPurchaseOrderScan $pendingScans): RedirectResponse
    {
        $pendingScans->discard($request->session());

        return to_route('purchase-orders.scan');
    }
}
