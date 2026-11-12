<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * When the Specialist chose Leave it on a preorder item that reached the
     * Maintenance number, how many pieces were preordered then: it comes
     * back on the dashboard once 10 more are preordered.
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->unsignedInteger('preorder_alert_left_at')->nullable()->after('early_bird_pieces');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('preorder_alert_left_at');
        });
    }
};
