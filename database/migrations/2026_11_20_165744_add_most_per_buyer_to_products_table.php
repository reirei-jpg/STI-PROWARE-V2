<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The most pieces of a product one buyer can get, all sizes and colors
     * together (panel revision, 20 Nov 2026), so a few shirts reach more
     * buyers. Null: no limit of its own.
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->unsignedInteger('most_per_buyer')->nullable()->after('low_stock_alert_at');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('most_per_buyer');
        });
    }
};
