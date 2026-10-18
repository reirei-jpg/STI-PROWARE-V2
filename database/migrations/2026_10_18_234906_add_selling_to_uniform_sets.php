<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Students can buy a course's uniform as a whole set: for boys the polo
     * and pants, for girls the blouse and the ladies' pants or the skirt, at
     * what the two pieces cost. In the cart a set is two lines (top and
     * bottom) that share a set key; in an order its two items keep the
     * set's name.
     */
    public function up(): void
    {
        Schema::table('uniform_sets', function (Blueprint $table) {
            $table->foreignId('ladies_pants_product_id')->nullable()->after('pants_product_id')->constrained('products')->nullOnDelete();
            $table->foreignId('skirt_product_id')->nullable()->after('ladies_pants_product_id')->constrained('products')->nullOnDelete();
            $table->boolean('sold_as_set')->default(false)->after('skirt_product_id');
        });

        Schema::table('cart_items', function (Blueprint $table) {
            $table->foreignId('uniform_set_id')->nullable()->after('product_pack_id')->constrained()->cascadeOnDelete();
            $table->string('set_key', 36)->nullable()->after('uniform_set_id')->index();
            $table->string('set_for', 10)->nullable()->after('set_key');
        });

        Schema::table('order_items', function (Blueprint $table) {
            // "<course, up to 60> Uniform Set (For Girls)"
            $table->string('set_name', 120)->nullable()->after('variant_label');
            $table->string('set_key', 36)->nullable()->after('set_name');
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn(['set_name', 'set_key']);
        });

        Schema::table('cart_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('uniform_set_id');
            $table->dropColumn(['set_key', 'set_for']);
        });

        Schema::table('uniform_sets', function (Blueprint $table) {
            $table->dropConstrainedForeignId('ladies_pants_product_id');
            $table->dropConstrainedForeignId('skirt_product_id');
            $table->dropColumn('sold_as_set');
        });
    }
};
