<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A sale runs for a number of days: when it started, when it ends
     * (then the product goes back to Available), and whether the "sale
     * ending tomorrow" notice was sent. Packs students can buy may get
     * their own sale price.
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->timestamp('sale_started_at')->nullable();
            $table->timestamp('sale_ends_at')->nullable()->index();
            $table->timestamp('sale_ending_notified_at')->nullable();
        });

        Schema::table('product_packs', function (Blueprint $table) {
            $table->unsignedBigInteger('sale_price_centavos')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex(['sale_ends_at']);
            $table->dropColumn(['sale_started_at', 'sale_ends_at', 'sale_ending_notified_at']);
        });

        Schema::table('product_packs', function (Blueprint $table) {
            $table->dropColumn('sale_price_centavos');
        });
    }
};
