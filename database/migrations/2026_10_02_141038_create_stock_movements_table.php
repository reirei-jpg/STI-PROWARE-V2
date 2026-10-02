<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Every change to a variant's stock, in pieces, with the balance after
     * it: the stock history. A delivered item is added to stock at most once
     * (delivery_item_id is unique), and for a delivery the eStore quantity
     * and the pack it came in are kept, e.g. 2 × Pack (50 pieces) = +100.
     */
    public function up(): void
    {
        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_variant_id')->constrained();
            $table->string('type', 20);
            $table->integer('quantity');
            $table->integer('balance_after');
            $table->foreignId('delivery_item_id')->nullable()->unique()->constrained();
            $table->unsignedInteger('units_received')->nullable();
            $table->string('unit_name', 30)->nullable();
            $table->unsignedInteger('pieces_per_unit')->nullable();
            $table->string('reason', 40)->nullable();
            $table->string('note', 200)->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['product_variant_id', 'id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
    }
};
