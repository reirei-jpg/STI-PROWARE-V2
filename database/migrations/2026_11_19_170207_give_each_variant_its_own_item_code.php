<?php

use App\Services\Products\ProductCode;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * One code is one variant, so a delivery goes only into the size or
     * color it is. Variants of a product that shared one code get their own,
     * made from it (PRAF01-01 → PRAF01-01-BLACK), as the product form makes
     * them. The product keeps the shared code as its own Item Code, so the
     * costs on its earlier orders are still found.
     */
    public function up(): void
    {
        $shared = DB::table('product_variants')
            ->whereNotNull('estore_item_code')
            ->select(['product_id', 'estore_item_code'])
            ->groupBy('product_id', 'estore_item_code')
            ->havingRaw('count(*) > 1')
            ->get();

        foreach ($shared as $group) {
            $variants = DB::table('product_variants')
                ->where('product_id', $group->product_id)
                ->where('estore_item_code', $group->estore_item_code)
                ->orderBy('position')
                ->orderBy('id')
                ->get(['id', 'choices']);

            $codes = ProductCode::variantCodes(
                $group->estore_item_code,
                $variants->mapWithKeys(fn (object $variant): array => [$variant->id => json_decode((string) $variant->choices, true) ?: []])->all(),
            );

            foreach ($codes as $variantId => $code) {
                $taken = DB::table('product_variants')->where('estore_item_code', $code)->where('id', '!=', $variantId)->exists()
                    || DB::table('products')->where('item_code', $code)->exists();

                DB::table('product_variants')->where('id', $variantId)->update([
                    'estore_item_code' => $taken || $code === $group->estore_item_code ? $group->estore_item_code.'-'.$variantId : $code,
                ]);
            }

            if (! DB::table('products')->where('item_code', $group->estore_item_code)->exists()) {
                DB::table('products')->where('id', $group->product_id)->whereNull('item_code')->update(['item_code' => $group->estore_item_code]);
            }
        }
    }

    public function down(): void
    {
        //
    }
};
