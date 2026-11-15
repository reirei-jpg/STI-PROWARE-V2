<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Wrong passwords in a row, and until when the account is locked after 5
 * (see App\Services\Auth\SignInLock).
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedTinyInteger('failed_sign_ins')->default(0)->after('password');
            $table->timestamp('locked_until')->nullable()->after('failed_sign_ins');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['failed_sign_ins', 'locked_until']);
        });
    }
};
