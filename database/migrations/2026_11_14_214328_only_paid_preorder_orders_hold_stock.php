<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * The old 24-hour holds are gone: an order made from one is a normal
     * order now, so its pieces are free again and whoever pays first gets
     * them. Only the order of a released paid preorder keeps its pieces
     * (those preorders have no held_until).
     */
    public function up(): void
    {
        DB::table('product_variants')->update(['held_pieces' => 0]);

        DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.status', 'placed')
            ->whereExists(fn ($preorders) => $preorders->selectRaw('1')->from('preorders')->whereColumn('preorders.order_id', 'orders.id')->whereNull('preorders.held_until'))
            ->selectRaw('order_items.product_variant_id, sum(order_items.quantity * order_items.pieces_per_unit) as pieces')
            ->groupBy('order_items.product_variant_id')
            ->get()
            ->each(fn (object $row) => DB::table('product_variants')->where('id', $row->product_variant_id)->update(['held_pieces' => (int) $row->pieces]));
    }

    public function down(): void
    {
        //
    }
};
