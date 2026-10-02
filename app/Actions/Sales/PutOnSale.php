<?php

namespace App\Actions\Sales;

use App\Enums\ProductStatus;
use App\Models\Product;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Puts a product On Sale for a number of days, or changes the sale it is
 * already on: the sale price per piece (for every size and color), sale
 * prices for packs, and the end, which is the end of the last day.
 */
class PutOnSale
{
    /**
     * @param  array<int, int>  $packSalePrices  sale price in centavos by pack id; packs left out keep their price
     */
    public function handle(Product $product, ?int $piecePriceCentavos, array $packSalePrices, int $days): CarbonImmutable
    {
        $endsAt = now()->addDays($days)->endOfDay();

        DB::transaction(function () use ($product, $piecePriceCentavos, $packSalePrices, $endsAt): void {
            $product->forceFill([
                'status' => ProductStatus::OnSale,
                'sale_price_centavos' => $product->sold_by_piece ? $piecePriceCentavos : null,
                'sale_started_at' => $product->status === ProductStatus::OnSale ? $product->sale_started_at : now(),
                'sale_ends_at' => $endsAt,
                'sale_ending_notified_at' => null,
            ])->save();

            foreach ($product->packs as $pack) {
                $pack->update(['sale_price_centavos' => $packSalePrices[$pack->id] ?? null]);
            }
        });

        return $endsAt;
    }
}
