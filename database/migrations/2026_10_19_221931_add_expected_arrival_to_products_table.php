<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * When a Preorder product is expected to arrive, as a range of days the
     * Specialist sets (and changes when Head Office is late), so students
     * know when to expect it.
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->date('expected_arrival_from')->nullable()->after('preorders_close_on');
            $table->date('expected_arrival_to')->nullable()->after('expected_arrival_from');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['expected_arrival_from', 'expected_arrival_to']);
        });
    }
};
