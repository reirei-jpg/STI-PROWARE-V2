<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A preorder of a size already sold in the store but sold out is a Back
     * Order (panel revision A2); one of a Coming Soon item stays a Preorder.
     * Existing ones: a Back Order when the item had arrived before it was
     * placed.
     */
    public function up(): void
    {
        Schema::table('preorders', function (Blueprint $table) {
            $table->string('kind', 12)->default('preorder')->after('status');
        });

        DB::table('preorders')
            ->whereExists(fn ($movements) => $movements
                ->selectRaw('1')
                ->from('stock_movements')
                ->join('product_variants', 'product_variants.id', '=', 'stock_movements.product_variant_id')
                ->whereColumn('product_variants.product_id', 'preorders.product_id')
                ->where('stock_movements.type', 'delivery')
                ->whereColumn('stock_movements.created_at', '<', 'preorders.created_at'))
            ->update(['kind' => 'back_order']);
    }

    public function down(): void
    {
        Schema::table('preorders', function (Blueprint $table) {
            $table->dropColumn('kind');
        });
    }
};
