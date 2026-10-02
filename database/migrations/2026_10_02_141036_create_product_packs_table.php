<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Packs of a product, e.g. "Pack" = 50 pieces. Head Office may send an
     * item by the pack, and students may buy a whole pack at its own price.
     */
    public function up(): void
    {
        Schema::create('product_packs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('name', 30);
            $table->unsignedInteger('pieces');
            $table->boolean('sold_to_students')->default(false);
            $table->unsignedBigInteger('price_centavos')->nullable();
            $table->unsignedSmallInteger('position');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('product_packs');
    }
};
