<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Some eStore items cover every variant of a product, e.g. one code for
     * an umbrella in every color. Those variants share the code, and the
     * Specialist splits each delivery by variant, so one delivered item can
     * add to several variants' stock (once per variant).
     */
    public function up(): void
    {
        Schema::table('product_variants', function (Blueprint $table) {
            $table->dropUnique(['estore_item_code']);
            $table->index('estore_item_code');
        });

        Schema::table('stock_movements', function (Blueprint $table) {
            $table->unique(['delivery_item_id', 'product_variant_id']);
            $table->dropUnique(['delivery_item_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('stock_movements', function (Blueprint $table) {
            $table->unique('delivery_item_id');
            $table->dropUnique(['delivery_item_id', 'product_variant_id']);
        });

        Schema::table('product_variants', function (Blueprint $table) {
            $table->dropIndex(['estore_item_code']);
            $table->unique('estore_item_code');
        });
    }
};
