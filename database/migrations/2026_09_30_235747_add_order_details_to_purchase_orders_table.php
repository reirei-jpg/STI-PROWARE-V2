<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The eStore's Order # now identifies each order (it also stops the same
     * order being uploaded twice), so the old date + total + items
     * fingerprint is no longer needed. School and Ordered by come from the
     * order details email.
     */
    public function up(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->string('order_number', 40)->nullable()->unique()->after('id');
            $table->string('school')->nullable()->after('order_number');
            $table->string('ordered_by')->nullable()->after('school');
            $table->index('category');
        });

        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropUnique(['fingerprint']);
            $table->dropColumn('fingerprint');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->string('fingerprint', 64)->nullable()->unique();
        });

        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropIndex(['category']);
            $table->dropUnique(['order_number']);
            $table->dropColumn(['order_number', 'school', 'ordered_by']);
        });
    }
};
