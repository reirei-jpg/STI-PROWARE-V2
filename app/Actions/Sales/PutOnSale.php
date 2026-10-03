<?php

namespace App\Actions\Sales;

use App\Enums\ProductStatus;
use App\Models\Product;
use App\Models\ProductVariant;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Puts a product On Sale for a number of days, or changes the sale it is
 * already on: one sale price per piece for every variant, or (when the
 * variants have different normal prices) a sale price per normal price,
 * sale prices for packs, and the end, which is the end of the last day.
 */
class PutOnSale
{
    /**
     * @param  int|null  $piecePriceCentavos  one sale price per piece for every variant
     * @param  array<int, int>  $groupSalePrices  sale price by the normal price it lowers; variants at other prices stay at their normal price
     * @param  array<int, int>  $packSalePrices  sale price in centavos by pack id; packs left out keep their price
     */
    public function handle(Product $product, ?int $piecePriceCentavos, array $groupSalePrices, array $packSalePrices, int $days): CarbonImmutable
    {
        $endsAt = now()->addDays($days)->endOfDay();
        $byGroup = $groupSalePrices !== [] && $product->sold_by_piece;

        DB::transaction(function () use ($product, $piecePriceCentavos, $groupSalePrices, $byGroup, $packSalePrices, $endsAt): void {
            $product->forceFill([
                'status' => ProductStatus::OnSale,
                'sale_price_centavos' => $product->sold_by_piece && ! $byGroup ? $piecePriceCentavos : null,
                'sale_started_at' => $product->status === ProductStatus::OnSale ? $product->sale_started_at : now(),
                'sale_ends_at' => $endsAt,
                'sale_ending_notified_at' => null,
            ])->save();

            foreach ($product->variants()->with('product')->get() as $variant) {
                /** @var ProductVariant $variant */
                $normal = $variant->normalPiecePrice();
                $variant->forceFill([
                    'sale_price_centavos' => $byGroup && $normal !== null ? ($groupSalePrices[$normal] ?? null) : null,
                ])->save();
            }

            foreach ($product->packs as $pack) {
                $pack->update(['sale_price_centavos' => $packSalePrices[$pack->id] ?? null]);
            }
        });

        return $endsAt;
    }
}
