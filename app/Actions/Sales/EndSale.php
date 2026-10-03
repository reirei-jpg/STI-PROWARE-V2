<?php

namespace App\Actions\Sales;

use App\Enums\ProductStatus;
use App\Models\Product;
use Illuminate\Support\Facades\DB;

/**
 * Ends a product's sale, early or when its days are up: it goes back to
 * Available at its normal prices.
 */
class EndSale
{
    public function handle(Product $product): void
    {
        DB::transaction(function () use ($product): void {
            $product->forceFill([
                'status' => ProductStatus::Available,
                'sale_price_centavos' => null,
                'sale_started_at' => null,
                'sale_ends_at' => null,
                'sale_ending_notified_at' => null,
            ])->save();

            $product->packs()->update(['sale_price_centavos' => null]);
            $product->variants()->update(['sale_price_centavos' => null]);
        });
    }
}
