<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The stock (in pieces) at which the Specialist is warned, per product
     * and applied to each variant, and when a variant's warning was sent,
     * so it is sent once until the stock rises above the number again.
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->unsignedInteger('low_stock_alert_at')->default(5);
        });

        Schema::table('product_variants', function (Blueprint $table) {
            $table->timestamp('low_stock_notified_at')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('low_stock_alert_at');
        });

        Schema::table('product_variants', function (Blueprint $table) {
            $table->dropColumn('low_stock_notified_at');
        });
    }
};
