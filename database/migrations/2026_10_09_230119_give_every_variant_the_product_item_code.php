<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * A product now has one eStore Item Code that every size, color and
     * department uses. Products whose code was typed on only some variants
     * (e.g. the umbrella's code only on Black) give that code, and the pack
     * Head Office sends it by, to their variants without one.
     *
     * Products with two different codes are left as they are: the form asks
     * for one code the next time they are saved.
     */
    public function up(): void
    {
        $codedProducts = DB::table('product_variants')
            ->whereNotNull('estore_item_code')
            ->select('product_id')
            ->groupBy('product_id')
            ->havingRaw('COUNT(DISTINCT estore_item_code) = 1')
            ->pluck('product_id');

        foreach ($codedProducts as $productId) {
            $coded = DB::table('product_variants')
                ->where('product_id', $productId)
                ->whereNotNull('estore_item_code')
                ->orderBy('id')
                ->first(['estore_item_code', 'estore_pack_id']);

            if ($coded === null) {
                continue;
            }

            DB::table('product_variants')
                ->where('product_id', $productId)
                ->whereNull('estore_item_code')
                ->update([
                    'estore_item_code' => $coded->estore_item_code,
                    'estore_pack_id' => $coded->estore_pack_id,
                    'updated_at' => now(),
                ]);
        }
    }

    /**
     * Which variants had no code before cannot be told apart afterwards, so
     * the codes are kept.
     */
    public function down(): void
    {
        //
    }
};
