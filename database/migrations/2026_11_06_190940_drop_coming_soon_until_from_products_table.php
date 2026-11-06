<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A Coming Soon product that arrives moves to All Merchandise at once, and
     * its message lasts as long as its NEW tag (new_until), so this date is
     * no longer used.
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('coming_soon_until');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->timestamp('coming_soon_until')->nullable();
        });
    }
};
