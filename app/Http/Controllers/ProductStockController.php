<?php

namespace App\Http\Controllers;

use App\Actions\Stock\CorrectStock;
use App\Enums\StockCorrectionReason;
use App\Http\Requests\CorrectStockRequest;
use App\Http\Requests\FilterStockHistoryRequest;
use App\Models\Product;
use App\Services\Stock\ProductStock;
use App\Services\Stock\Units;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

/**
 * A product's stock: how many pieces each variant has, every change to it
 * (deliveries, corrections, student orders and their cancellations) with
 * the balance after, and the Specialist's
 * Correct stock action.
 */
class ProductStockController extends Controller
{
    /**
     * The Stock History page, newest change first, optionally for one
     * variant.
     */
    public function index(FilterStockHistoryRequest $request, Product $product): Response
    {
        $variantId = $request->variantId();

        return Inertia::render('products/stock', [
            ...ProductStock::summary($product),
            'movements' => ProductStock::history($product, $variantId),
            'filters' => ['variant' => $variantId],
            'reasons' => array_map(fn (StockCorrectionReason $reason): array => [
                'value' => $reason->value,
                'label' => $reason->label(),
                'removes_pieces' => $reason->removesPieces(),
            ], StockCorrectionReason::cases()),
        ]);
    }

    public function store(CorrectStockRequest $request, Product $product, CorrectStock $correctStock): RedirectResponse
    {
        $variant = $request->variant();
        $reason = $request->reason();

        $correction = $correctStock->handle(
            $variant,
            $request->user(),
            $reason,
            $reason->removesPieces() ? $request->integer('pieces_to_remove') : $request->integer('actual_count'),
            $request->note(),
            $request->centavosPerPiece(),
            $request->recipient(),
        );

        $before = $correction->balance_after - $correction->quantity;
        $change = ($correction->quantity > 0 ? '+' : '−').Units::count(abs($correction->quantity), 'Piece');

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => "Stock of {$variant->displayName()} corrected: ".number_format($before).' → '.Units::count($correction->balance_after, 'Piece')." ({$change}). Reason: {$reason->label()}.",
        ]);

        return back();
    }
}
