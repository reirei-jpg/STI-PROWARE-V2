<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Orders no longer have a Ready step, a pick-up date or an expiry, and
     * they no longer hold stock: whoever pays first gets it. Only pieces of
     * an arrived preorder that its buyer ordered stay held for that order.
     * A line released with fewer than ordered keeps how many were short.
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->timestamp('pick_up_by')->nullable()->change();
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->unsignedInteger('quantity_short')->default(0)->after('quantity');
        });

        DB::table('orders')->where('status', 'ready')->update(['status' => 'placed']);

        // Held pieces: only those of open orders placed from an arrived preorder.
        DB::table('product_variants')->update(['held_pieces' => 0]);

        DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.status', 'placed')
            ->whereExists(fn ($preorders) => $preorders->selectRaw('1')->from('preorders')->whereColumn('preorders.order_id', 'orders.id'))
            ->selectRaw('order_items.product_variant_id, sum(order_items.quantity * order_items.pieces_per_unit) as pieces')
            ->groupBy('order_items.product_variant_id')
            ->get()
            ->each(fn (object $row) => DB::table('product_variants')->where('id', $row->product_variant_id)->update(['held_pieces' => (int) $row->pieces]));
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn('quantity_short');
        });
    }
};
