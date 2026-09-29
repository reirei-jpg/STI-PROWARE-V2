<?php

namespace App\Http\Controllers;

use App\Http\Requests\ScanEstorePoRequest;
use App\Services\EstorePo\EstorePoParser;
use App\Services\EstorePo\UnreadablePurchaseOrderException;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Lets the PROWARE Specialist upload an eStore purchase order and preview
 * what the scanner read from it. Nothing is saved at this stage.
 */
class PurchaseOrderScanController extends Controller
{
    /**
     * Show the upload form.
     */
    public function create(): Response
    {
        return Inertia::render('purchase-orders/scan', [
            'scan' => null,
            'fileName' => null,
        ]);
    }

    /**
     * Scan the uploaded file and show the result on the same page.
     */
    public function store(ScanEstorePoRequest $request, EstorePoParser $parser): Response
    {
        $document = $request->file('document');

        try {
            $scan = $parser->parseFile($document->getRealPath());
        } catch (UnreadablePurchaseOrderException $exception) {
            throw ValidationException::withMessages(['document' => $exception->getMessage()]);
        }

        return Inertia::render('purchase-orders/scan', [
            'scan' => $scan->toArray(),
            'fileName' => $document->getClientOriginalName(),
        ]);
    }
}
