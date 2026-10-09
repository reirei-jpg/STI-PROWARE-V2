<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * When the student was told their preordered item arrived. Preorders of
     * products already for sale are marked Arrived now, so they stop
     * counting as still to order.
     */
    public function up(): void
    {
        Schema::table('preorders', function (Blueprint $table) {
            $table->timestamp('arrived_at')->nullable()->after('cancelled_at');
        });

        DB::table('preorders')
            ->where('status', 'active')
            ->whereIn('product_id', DB::table('products')->select('id')->whereIn('status', ['available', 'on_sale']))
            ->update(['status' => 'arrived', 'arrived_at' => now()]);
    }

    public function down(): void
    {
        DB::table('preorders')->where('status', 'arrived')->update(['status' => 'active']);

        Schema::table('preorders', function (Blueprint $table) {
            $table->dropColumn('arrived_at');
        });
    }
};
