<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The first day buyers can pay for their preorders of a product. With
     * the close date it makes the payment dates: preorders not paid by the
     * close date are dropped. Null: no payment dates set yet.
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->date('preorder_pay_from')->nullable()->after('preorders_close_on');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('preorder_pay_from');
        });
    }
};
