<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Each product gets its own Item Code (e.g. BP-01) and each variant its
     * own status (Draft, Preorder or Available), so one size or color can
     * stay hidden while the others are in the store.
     *
     * Variants start with their product's status (On Sale counts as
     * Available). A product whose variants all share one eStore Item Code
     * gets that code as its own.
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('item_code', 40)->nullable()->unique()->after('name');
        });

        Schema::table('product_variants', function (Blueprint $table) {
            $table->string('status', 20)->default('available')->after('combination');
        });

        DB::table('products')->select(['id', 'status'])->orderBy('id')->get()->each(function (object $product): void {
            DB::table('product_variants')->where('product_id', $product->id)->update([
                'status' => in_array($product->status, ['draft', 'preorder'], true) ? $product->status : 'available',
            ]);

            $codes = DB::table('product_variants')->where('product_id', $product->id)->whereNotNull('estore_item_code')->distinct()->pluck('estore_item_code');

            if ($codes->count() === 1 && ! DB::table('products')->where('item_code', $codes->first())->exists()) {
                DB::table('products')->where('id', $product->id)->update(['item_code' => $codes->first()]);
            }
        });
    }

    public function down(): void
    {
        Schema::table('product_variants', function (Blueprint $table) {
            $table->dropColumn('status');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropUnique(['item_code']);
            $table->dropColumn('item_code');
        });
    }
};
