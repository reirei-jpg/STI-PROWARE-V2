<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A sold-out size the Specialist said will not be restocked: students
     * can no longer preorder it, and the preorders waiting for it were
     * closed (with her reason, if she gave one). Cleared when stock comes in
     * anyway.
     */
    public function up(): void
    {
        Schema::table('product_variants', function (Blueprint $table) {
            $table->timestamp('not_restocked_at')->nullable()->after('low_stock_notified_at');
        });

        Schema::table('preorders', function (Blueprint $table) {
            $table->timestamp('not_restocked_at')->nullable()->after('arrived_at');
            $table->string('not_restocked_reason', 200)->nullable()->after('not_restocked_at');
        });
    }

    public function down(): void
    {
        DB::table('preorders')->where('status', 'not_restocked')->update(['status' => 'cancelled', 'cancelled_at' => DB::raw('not_restocked_at')]);

        Schema::table('preorders', function (Blueprint $table) {
            $table->dropColumn(['not_restocked_at', 'not_restocked_reason']);
        });

        Schema::table('product_variants', function (Blueprint $table) {
            $table->dropColumn('not_restocked_at');
        });
    }
};
