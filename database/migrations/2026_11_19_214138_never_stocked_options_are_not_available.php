<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * A size or color with no stock cannot be Available. When each variant
     * got its own status, every variant took its product's, so sizes that
     * never had any stock became Available too. They are Preorder now: the
     * store still shows them as out of stock, and buyers can preorder them.
     * Sizes that had stock and sold out stay Available.
     */
    public function up(): void
    {
        DB::table('product_variants')
            ->where('status', 'available')
            ->where('stock_on_hand', 0)
            ->whereNotExists(fn ($movements) => $movements
                ->selectRaw('1')
                ->from('stock_movements')
                ->whereColumn('stock_movements.product_variant_id', 'product_variants.id'))
            ->update(['status' => 'preorder']);
    }

    public function down(): void
    {
        //
    }
};
