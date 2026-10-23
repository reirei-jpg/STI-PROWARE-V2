<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Why a line was sold below its normal price (sale or early_bird). Lines
     * from before this column were only ever lowered by a sale.
     */
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->string('lower_price_reason', 20)->nullable()->after('normal_unit_price_centavos');
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn('lower_price_reason');
        });
    }
};
