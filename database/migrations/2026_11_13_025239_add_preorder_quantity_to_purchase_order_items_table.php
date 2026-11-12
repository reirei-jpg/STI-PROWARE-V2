<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * How much of each eStore PO item was ordered for buyers' preorders
     * (in the PO's own units); the rest is the Specialist's own order.
     * Null on POs saved before this was tracked.
     */
    public function up(): void
    {
        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->unsignedInteger('preorder_quantity')->nullable()->after('quantity_delivered');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->dropColumn('preorder_quantity');
        });
    }
};
