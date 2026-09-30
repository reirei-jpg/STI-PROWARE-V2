<?php

namespace App\Http\Controllers;

use App\Http\Requests\ScanEstorePoRequest;
use App\Models\PurchaseOrder;
use App\Services\EstorePo\EstorePoParser;
use App\Services\EstorePo\PendingPurchaseOrderScan;
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
        ]);
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
