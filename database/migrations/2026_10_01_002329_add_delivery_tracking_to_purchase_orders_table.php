<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Delivery tracking on each order: the expected delivery date the
     * Specialist enters after Head Office calls (with the reminders already
     * sent for it), running totals of what was ordered and received, the
     * delivery status, and why an order was closed short.
     */
    public function up(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->date('expected_delivery_date')->nullable()->index();
            $table->string('expected_delivery_note', 200)->nullable();
            $table->timestamp('day_before_reminder_sent_at')->nullable();
            $table->timestamp('day_of_reminder_sent_at')->nullable();
            $table->unsignedInteger('quantity_ordered_total')->default(0);
            $table->unsignedInteger('quantity_received_total')->default(0);
            $table->string('delivery_status')->default('awaiting')->index();
            $table->string('closed_reason', 500)->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->foreignId('closed_by')->nullable()->constrained('users')->nullOnDelete();
        });

        DB::statement(
            'update purchase_orders set quantity_ordered_total = '
            .'(select coalesce(sum(quantity_ordered), 0) from purchase_order_items where purchase_order_items.purchase_order_id = purchase_orders.id)'
        );
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('closed_by');
            $table->dropIndex(['expected_delivery_date']);
            $table->dropIndex(['delivery_status']);
            $table->dropColumn([
                'expected_delivery_date',
                'expected_delivery_note',
                'day_before_reminder_sent_at',
                'day_of_reminder_sent_at',
                'quantity_ordered_total',
                'quantity_received_total',
                'delivery_status',
                'closed_reason',
                'closed_at',
            ]);
        });
    }
};
