<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('purchase_order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchase_order_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('row_number');
            $table->string('item_code');
            $table->string('description');
            $table->unsignedInteger('stock_on_hand')->nullable();
            $table->unsignedInteger('quantity_ordered');
            $table->unsignedInteger('quantity_delivered')->default(0);
            $table->unsignedBigInteger('unit_price_centavos');
            $table->unsignedBigInteger('amount_centavos');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('purchase_order_items');
    }
};
