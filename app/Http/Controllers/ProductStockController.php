<?php

namespace App\Http\Controllers;

use App\Actions\Stock\CorrectStock;
use App\Enums\StockCorrectionReason;
use App\Http\Requests\CorrectStockRequest;
use App\Http\Requests\FilterStockHistoryRequest;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Services\Stock\LowStockAlerts;
use App\Services\Stock\Units;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

/**
 * A product's stock: how many pieces each variant has, every change to it
 * (deliveries and corrections) with the balance after, and the Specialist's
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
        $product->load(['variants.estorePack']);
        $variantId = $request->variantId();

        $movements = StockMovement::query()
            ->whereIn('product_variant_id', $product->variants()->select('id'))
            ->when($variantId, fn (Builder $query, int $id) => $query->where('product_variant_id', $id))
            ->with(['variant', 'recorder', 'deliveryItem.delivery', 'deliveryItem.purchaseOrderItem.purchaseOrder'])
            ->latest('id')
            ->paginate(20)
            ->withQueryString()
            ->through(fn (StockMovement $movement): array => [
                'id' => $movement->id,
                'created_at' => $movement->created_at?->toIso8601String(),
                'variant_label' => $movement->variant->label(),
                'type' => $movement->type->value,
                'type_label' => $movement->type->label(),
                'quantity' => $movement->quantity,
                'balance_after' => $movement->balance_after,
                'units_received' => $movement->units_received,
                'unit_name' => $movement->unit_name,
                'pieces_per_unit' => $movement->pieces_per_unit,
                'reason_label' => $movement->reason?->label(),
                'note' => $movement->note,
                'delivery' => $movement->deliveryItem === null ? null : [
                    'received_on' => $movement->deliveryItem->delivery->received_on->toDateString(),
                    'sales_invoice_number' => $movement->deliveryItem->delivery->sales_invoice_number,
                    'order_number' => $movement->deliveryItem->purchaseOrderItem->purchaseOrder->order_number,
                ],
                'recorded_by' => $movement->recorder?->name,
            ]);

        return Inertia::render('products/stock', [
            'product' => [
                'id' => $product->id,
                'name' => $product->name,
                'has_options' => $product->variants->contains(fn (ProductVariant $variant): bool => $variant->choices !== []),
                'stock_on_hand' => (int) $product->variants->sum('stock_on_hand'),
                'low_stock_alert_at' => $product->low_stock_alert_at,
                'is_sold' => LowStockAlerts::isSold($product),
            ],
            'variants' => $product->variants->map(fn (ProductVariant $variant): array => [
                'id' => $variant->id,
                'label' => $variant->label(),
                'stock_on_hand' => $variant->stock_on_hand,
                'estore_item_code' => $variant->estore_item_code,
                'sent_by' => $variant->estorePack?->label(),
            ])->all(),
            'movements' => $movements,
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
