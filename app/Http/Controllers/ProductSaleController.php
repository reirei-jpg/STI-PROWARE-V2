<?php

namespace App\Http\Controllers;

use App\Actions\Sales\EndSale;
use App\Actions\Sales\PutOnSale;
use App\Enums\ProductStatus;
use App\Http\Requests\PutOnSaleRequest;
use App\Models\Product;
use App\Models\ProductPack;
use App\Services\Sales\HeadOfficeCost;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;

/**
 * Put on Sale: the Specialist lowers a product's price for a number of
 * days, changes a running sale, or ends it early.
 */
class ProductSaleController extends Controller
{
    /**
     * What the Put on Sale pop-up needs: normal prices, stock, the Head
     * Office cost per piece (for the below-cost warning) and the running
     * sale, if any.
     */
    public function show(Product $product, HeadOfficeCost $headOfficeCost): JsonResponse
    {
        $product->load(['packs', 'variants']);
        $isOnSale = $product->status === ProductStatus::OnSale;

        return response()->json([
            'id' => $product->id,
            'name' => $product->name,
            'status' => $product->status->value,
            'sold_by_piece' => $product->sold_by_piece,
            'piece_price_centavos' => PutOnSaleRequest::lowestPiecePrice($product),
            'stock_on_hand' => (int) $product->variants->sum('stock_on_hand'),
            'cost_per_piece_centavos' => $headOfficeCost->perPiece($product),
            'packs' => $product->packs
                ->where('sold_to_students', true)
                ->map(fn (ProductPack $pack): array => [
                    'id' => $pack->id,
                    'name' => $pack->name,
                    'pieces' => $pack->pieces,
                    'price_centavos' => (int) $pack->price_centavos,
                    'sale_price_centavos' => $isOnSale ? $pack->sale_price_centavos : null,
                ])
                ->values()
                ->all(),
            'sale' => $isOnSale ? [
                'sale_price_centavos' => $product->sale_price_centavos,
                'ends_at' => $product->sale_ends_at?->toIso8601String(),
            ] : null,
            'max_days' => PutOnSaleRequest::MAX_DAYS,
        ]);
    }

    public function store(PutOnSaleRequest $request, Product $product, PutOnSale $putOnSale): RedirectResponse
    {
        $endsAt = $putOnSale->handle(
            $product,
            $request->piecePriceCentavos(),
            $request->packSalePrices(),
            $request->integer('days'),
        );

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => "{$product->name} is On Sale until {$endsAt->format('M j, Y g:i A')}.",
        ]);

        return back();
    }

    public function destroy(Product $product, EndSale $endSale): RedirectResponse
    {
        abort_unless($product->status === ProductStatus::OnSale, 404);

        $endSale->handle($product);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => "The sale of {$product->name} ended. It is back to its normal price.",
        ]);

        return back();
    }
}
