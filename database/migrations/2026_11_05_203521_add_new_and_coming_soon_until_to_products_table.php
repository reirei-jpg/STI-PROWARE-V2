<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * When a product's NEW tag ends (3 days after its stock first arrived)
     * and, for a Coming Soon product that arrived, when it leaves Coming
     * Soon (1 day after). Products that already had stock get the NEW date
     * of their first stock, so they are not shown as new.
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->timestamp('new_until')->nullable();
            $table->timestamp('coming_soon_until')->nullable();
        });

        DB::table('stock_movements')
            ->join('product_variants', 'product_variants.id', '=', 'stock_movements.product_variant_id')
            ->groupBy('product_variants.product_id')
            ->selectRaw('product_variants.product_id, min(stock_movements.created_at) as first_stock_at')
            ->get()
            ->each(fn (object $row) => DB::table('products')
                ->where('id', $row->product_id)
                ->update(['new_until' => Carbon::parse($row->first_stock_at)->addDays(3)]));
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['new_until', 'coming_soon_until']);
        });
    }
};
