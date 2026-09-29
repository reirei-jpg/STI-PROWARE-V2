<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * One combination of a product's options (e.g. Blue / 22 oz), or the
     * single default variant of a product without options. Its eStore Item
     * Code links it to the items on uploaded purchase orders.
     */
    public function up(): void
    {
        Schema::create('product_variants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('combination');
            $table->json('choices');
            $table->string('estore_item_code', 40)->nullable()->unique();
            $table->unsignedBigInteger('price_centavos')->nullable();
            $table->unsignedSmallInteger('position');
            $table->timestamps();

            $table->unique(['product_id', 'combination']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('product_variants');
    }
};
