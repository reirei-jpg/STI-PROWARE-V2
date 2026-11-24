<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Products get the eStore's category (required on the form from now on).
     * Existing uniforms take it from their name (program uniforms are
     * Tertiary Uniform, Senior High ones SHS Uniform); the rest from the
     * latest eStore order their items came on, else PROWARE Merchandise.
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('category', 30)->nullable()->after('name');
        });

        $fromEstore = [
            'PROWARE MERCHANDISE' => 'proware_merchandise',
            'PROWARE' => 'proware_merchandise',
            'TERTIARY UNIFORM' => 'tertiary_uniform',
            'SHS UNIFORM' => 'shs_uniform',
            'MARKETING' => 'marketing',
        ];

        foreach (DB::table('products')->get(['id', 'name', 'item_code']) as $product) {
            $codes = DB::table('product_variants')->where('product_id', $product->id)->whereNotNull('estore_item_code')->pluck('estore_item_code')
                ->push($product->item_code)->filter()->all();

            $estore = $codes === [] ? null : DB::table('purchase_order_items')
                ->join('purchase_orders', 'purchase_orders.id', '=', 'purchase_order_items.purchase_order_id')
                ->whereIn('purchase_order_items.item_code', $codes)
                ->orderByDesc('purchase_orders.id')
                ->value('purchase_orders.category');

            // A uniform's name is clearer than an order filed under plain "PROWARE".
            $name = mb_strtolower($product->name);
            $category = match (true) {
                str_contains($name, 'senior high') || str_contains($name, 'shs') => 'shs_uniform',
                (bool) preg_match('/\b(bs[a-z]{2,4})\b.*\b(polo|blouse|pants|skirt)\b/', $name) => 'tertiary_uniform',
                default => $fromEstore[mb_strtoupper(trim((string) $estore))] ?? 'proware_merchandise',
            };

            DB::table('products')->where('id', $product->id)->update(['category' => $category]);
        }
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('category');
        });
    }
};
