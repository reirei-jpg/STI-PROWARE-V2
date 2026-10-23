<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Which bottom the student got: pants, ladies' pants or a skirt (the
     * pants_variant_id / pants_movement_id columns hold that bottom). Groups
     * recorded before this all got the pants.
     */
    public function up(): void
    {
        Schema::table('free_uniform_students', function (Blueprint $table) {
            $table->string('bottom_kind', 20)->default('pants')->after('top_movement_id');
        });
    }

    public function down(): void
    {
        Schema::table('free_uniform_students', function (Blueprint $table) {
            $table->dropColumn('bottom_kind');
        });
    }
};
