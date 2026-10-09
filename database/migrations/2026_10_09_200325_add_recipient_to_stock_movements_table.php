<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Who received pieces given free (promo): the student's name and
     * enrollment form #, for the Sales Reports.
     */
    public function up(): void
    {
        Schema::table('stock_movements', function (Blueprint $table) {
            $table->string('recipient_name', 120)->nullable()->after('note');
            $table->string('enrollment_form_number', 40)->nullable()->after('recipient_name');
        });
    }

    public function down(): void
    {
        Schema::table('stock_movements', function (Blueprint $table) {
            $table->dropColumn(['recipient_name', 'enrollment_form_number']);
        });
    }
};
