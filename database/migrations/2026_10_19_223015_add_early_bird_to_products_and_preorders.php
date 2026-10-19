<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * An optional early-bird price for a Preorder product: the first pieces
     * preordered (first come, first served) get it. Each preorder keeps how
     * many of its pieces got the early-bird price.
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->unsignedInteger('early_bird_price_centavos')->nullable()->after('expected_arrival_to');
            $table->unsignedInteger('early_bird_pieces')->nullable()->after('early_bird_price_centavos');
        });

        Schema::table('preorders', function (Blueprint $table) {
            $table->unsignedInteger('early_bird_pieces')->default(0)->after('quantity');
        });
    }

    public function down(): void
    {
        Schema::table('preorders', function (Blueprint $table) {
            $table->dropColumn('early_bird_pieces');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['early_bird_price_centavos', 'early_bird_pieces']);
        });
    }
};
