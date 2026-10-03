<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A variant's own sale price while the product is On Sale, for products
     * whose sizes have different prices (e.g. S ₱300, XL ₱350). Empty means
     * the product's sale price applies, or none when it has none.
     */
    public function up(): void
    {
        Schema::table('product_variants', function (Blueprint $table) {
            $table->unsignedBigInteger('sale_price_centavos')->nullable()->after('price_centavos');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('product_variants', function (Blueprint $table) {
            $table->dropColumn('sale_price_centavos');
        });
    }
};
