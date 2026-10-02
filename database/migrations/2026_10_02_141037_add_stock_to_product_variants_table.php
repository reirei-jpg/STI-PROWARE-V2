<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Each variant's stock on hand, always counted in pieces, and how Head
     * Office sends its eStore item: by the piece (no pack) or by one of the
     * product's packs.
     */
    public function up(): void
    {
        Schema::table('product_variants', function (Blueprint $table) {
            $table->foreignId('estore_pack_id')->nullable()->constrained('product_packs');
            $table->integer('stock_on_hand')->default(0);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('product_variants', function (Blueprint $table) {
            $table->dropConstrainedForeignId('estore_pack_id');
            $table->dropColumn('stock_on_hand');
        });
    }
};
