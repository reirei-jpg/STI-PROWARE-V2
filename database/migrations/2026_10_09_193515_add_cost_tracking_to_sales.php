<?php

use App\Services\Stock\StockCost;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * What PROWARE paid for its stock (from the uploaded eStore purchase
     * orders) and what each sale earned:
     * - stock movements: the eStore cost of the pieces that came in (a
     *   delivery, or a recount that adds pieces), or that a sale took out;
     * - order items: the normal price when ordered (so a sale price shows as
     *   a discount) and the eStore cost of the pieces released;
     * - variants: the eStore price per piece of stock that was there before
     *   any delivery was recorded, entered once by the Specialist, and how
     *   many pieces in stock still have no eStore price.
     * Deliveries and sales already recorded get their costs now.
     */
    public function up(): void
    {
        Schema::table('stock_movements', function (Blueprint $table) {
            $table->unsignedBigInteger('cost_centavos')->nullable()->after('pieces_per_unit');
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->unsignedBigInteger('normal_unit_price_centavos')->nullable()->after('unit_price_centavos');
            $table->unsignedBigInteger('cost_centavos')->nullable()->after('line_total_centavos');
        });

        Schema::table('product_variants', function (Blueprint $table) {
            $table->unsignedBigInteger('opening_unit_cost_centavos')->nullable()->after('held_pieces');
            $table->unsignedInteger('uncosted_pieces')->default(0)->after('opening_unit_cost_centavos');
        });

        StockCost::backfill();
    }

    public function down(): void
    {
        Schema::table('product_variants', function (Blueprint $table) {
            $table->dropColumn(['opening_unit_cost_centavos', 'uncosted_pieces']);
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn(['normal_unit_price_centavos', 'cost_centavos']);
        });

        Schema::table('stock_movements', function (Blueprint $table) {
            $table->dropColumn('cost_centavos');
        });
    }
};
