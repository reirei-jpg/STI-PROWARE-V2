<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Head Office gives no delivery date, so purchase orders no longer have
     * an expected delivery date or the reminders sent for it. Orders to
     * follow up are now those not complete some days after their Date
     * Ordered. Old reminder notices are removed from the bell too.
     */
    public function up(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropIndex(['expected_delivery_date']);
            $table->dropColumn([
                'expected_delivery_date',
                'expected_delivery_note',
                'day_before_reminder_sent_at',
                'day_of_reminder_sent_at',
            ]);
        });

        DB::table('notifications')->where('type', 'App\\Notifications\\ExpectedDeliveryReminder')->delete();
    }

    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->date('expected_delivery_date')->nullable()->index();
            $table->string('expected_delivery_note', 200)->nullable();
            $table->timestamp('day_before_reminder_sent_at')->nullable();
            $table->timestamp('day_of_reminder_sent_at')->nullable();
        });
    }
};
