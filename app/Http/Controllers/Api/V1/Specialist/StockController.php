<?php

namespace App\Http\Controllers\Api\V1\Specialist;

use App\Http\Controllers\Controller;
use App\Http\Requests\FilterStockHistoryRequest;
use App\Models\Product;
use App\Services\Stock\LowStockAlerts;
use App\Services\Stock\ProductStock;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Stock lookup on the Specialist's phone: find a product by name (or only
 * those to reorder, at or below a Reorder Point), then see each size or
 * color's pieces, Reorder Point and the history of changes, as on the
 * website's Stock History page (ProductStock).
 */
class StockController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            'low' => ['nullable', 'boolean'],
        ]);
        $search = trim((string) ($validated['search'] ?? ''));

        return response()->json(Product::query()
            ->with('mainPhoto')
            ->withSum('variants', 'stock_on_hand')
            ->withSum('variants', 'held_pieces')
            ->withExists(['variants as has_variant_at_alert' => fn (Builder $variants) => $variants->atReorderPoint()])
            ->when($search !== '', fn (Builder $query) => $query->whereLike('name', "%{$search}%"))
            ->when($request->boolean('low'), fn (Builder $query) => $query->lowOnStock())
            ->orderBy('name')
            ->orderBy('id')
            ->paginate(20)
            ->withQueryString()
            ->through(fn (Product $product): array => [
                'id' => $product->id,
                'name' => $product->name,
                'photo_url' => $product->mainPhoto?->url(),
                // In the store with no pieces left reads as Out of stock, not Available.
                'status_label' => LowStockAlerts::isSold($product) && (int) $product->getAttribute('variants_sum_stock_on_hand') === 0
                    ? 'Out of stock'
                    : $product->status->label(),
                'stock_on_hand' => (int) $product->getAttribute('variants_sum_stock_on_hand'),
                'held_pieces' => (int) $product->getAttribute('variants_sum_held_pieces'),
                'low_stock_alert_at' => $product->low_stock_alert_at,
                'is_sold' => LowStockAlerts::isSold($product),
                'is_low' => LowStockAlerts::isSold($product) && (bool) $product->getAttribute('has_variant_at_alert'),
            ]));
    }

    /**
     * One product's stock per size or color and its latest changes.
     */
    public function show(FilterStockHistoryRequest $request, Product $product): JsonResponse
    {
        return response()->json([
            ...ProductStock::summary($product),
            'movements' => ProductStock::history($product, $request->variantId()),
        ]);
    }
}
