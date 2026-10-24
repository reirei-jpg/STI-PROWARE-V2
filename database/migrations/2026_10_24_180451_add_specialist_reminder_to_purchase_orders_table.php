<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * When (and by whom) the School Admin last reminded the Specialist about
     * a late order, so the next reminder waits a week.
     */
    public function up(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->timestamp('specialist_reminded_at')->nullable();
            $table->foreignId('specialist_reminded_by')->nullable()->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('specialist_reminded_by');
            $table->dropColumn('specialist_reminded_at');
        });
    }
};
