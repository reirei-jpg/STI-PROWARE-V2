<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Whether students can buy the product by the piece. A product sold only
     * by the pack has no price per piece, so that price becomes optional.
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->boolean('sold_by_piece')->default(true);
            $table->unsignedBigInteger('price_centavos')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('products')->whereNull('price_centavos')->update(['price_centavos' => 0]);

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('sold_by_piece');
            $table->unsignedBigInteger('price_centavos')->nullable(false)->change();
        });
    }
};
