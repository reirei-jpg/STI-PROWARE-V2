<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Every payment the cashier records, with its Payment Receipt (RCT-2026-000001):
     * for an order or a preorder slip, how it was paid (cash with the amount
     * received and the change, or GCash with its 13-digit reference), and who
     * received it. A payment undone by mistake stays on record as VOID with the
     * reason. Cashier data only: the Specialist never reads this table.
     */
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->string('receipt_number', 20)->nullable()->unique();
            $table->foreignId('order_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('preorder_slip_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('amount_centavos');
            $table->string('method', 10);
            $table->unsignedInteger('amount_received_centavos')->nullable();
            $table->unsignedInteger('change_centavos')->nullable();
            $table->string('gcash_reference', 13)->nullable()->index();
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('paid_at')->index();
            $table->timestamp('voided_at')->nullable();
            $table->foreignId('voided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('void_reason', 200)->nullable();
            // The receipt as issued: buyer, slip number and lines paid for (it never changes afterwards).
            $table->json('snapshot');
            $table->unsignedSmallInteger('prints')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
