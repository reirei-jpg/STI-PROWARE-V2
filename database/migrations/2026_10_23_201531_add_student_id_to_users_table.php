<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A student's 11-digit Student ID, given at registration (one account per
     * Student ID); shown on the issuance slip and to the Specialist. Staff
     * and students registered before this have none.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('student_id', 11)->nullable()->unique()->after('email');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['student_id']);
            $table->dropColumn('student_id');
        });
    }
};
