<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A payment the cashier recorded by mistake and undid the same day,
     * before release, kept on record with the reason: an order's or a
     * preorder slip's, what it was, when, by whom.
     */
    public function up(): void
    {
        Schema::create('undone_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('preorder_slip_id')->nullable()->constrained()->cascadeOnDelete();
            $table->unsignedInteger('amount_centavos');
            $table->timestamp('paid_at');
            $table->foreignId('paid_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('undone_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('reason', 200);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('undone_payments');
    }
};
