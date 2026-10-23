<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The pieces on the shelf when the low-stock warning was sent: the
     * variant is warned again only after more pieces come in (a delivery or
     * a recount), not when a cancelled order frees its pieces for a moment.
     */
    public function up(): void
    {
        Schema::table('product_variants', function (Blueprint $table) {
            $table->unsignedInteger('low_stock_notified_stock')->nullable()->after('low_stock_notified_at');
        });
    }

    public function down(): void
    {
        Schema::table('product_variants', function (Blueprint $table) {
            $table->dropColumn('low_stock_notified_stock');
        });
    }
};
