<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Each variant gets its own Reorder Point (ReorderPoints) and the pieces
     * it used in the last 30 days that it comes from. Until they are first
     * worked out (stock:reorder-points), the Reorder Point is the product's
     * safety stock, so nothing is reordered differently on the day it ships.
     */
    public function up(): void
    {
        Schema::table('product_variants', function (Blueprint $table) {
            $table->unsignedInteger('reorder_point')->default(0)->after('low_stock_notified_stock');
            $table->unsignedInteger('used_last_30_days')->default(0)->after('reorder_point');
        });

        DB::table('product_variants')->update([
            'reorder_point' => DB::raw('(select low_stock_alert_at from products where products.id = product_variants.product_id)'),
        ]);
    }

    public function down(): void
    {
        Schema::table('product_variants', function (Blueprint $table) {
            $table->dropColumn(['reorder_point', 'used_last_30_days']);
        });
    }
};
