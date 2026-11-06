<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A Coming Soon product that arrives now moves to All Merchandise at
     * once, so this date only says how long it shows "New stock is
     * available".
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->renameColumn('coming_soon_until', 'new_stock_until');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->renameColumn('new_stock_until', 'coming_soon_until');
        });
    }
};
