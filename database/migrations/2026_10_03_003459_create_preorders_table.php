<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Preorders are reservations: a student says which size or color of a
     * Preorder product they want and how many, so the Specialist knows how
     * many to order in the eStore. No payment. Each Preorder product has a
     * date after which no more preorders are taken; the Specialist can move
     * it later.
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->date('preorders_close_on')->nullable();
        });

        Schema::create('preorders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_variant_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('quantity');
            $table->string('status', 20)->default('active');
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamps();

            $table->index(['product_id', 'status']);
            $table->index(['user_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('preorders');

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('preorders_close_on');
        });
    }
};
