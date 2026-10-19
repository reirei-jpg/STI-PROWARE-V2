<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * When preordered pieces arrive they are held for the student for 24
     * hours (held_until): the variant counts them apart from what is free to
     * sell. The student orders them (order_id) or the hold ends
     * (hold_ended_at) and the pieces go to the next student waiting.
     */
    public function up(): void
    {
        Schema::table('product_variants', function (Blueprint $table) {
            $table->unsignedInteger('preorder_held_pieces')->default(0)->after('held_pieces');
        });

        Schema::table('preorders', function (Blueprint $table) {
            $table->timestamp('held_until')->nullable()->after('arrived_at');
            $table->timestamp('hold_ended_at')->nullable()->after('held_until');
            $table->foreignId('order_id')->nullable()->after('hold_ended_at')->constrained()->nullOnDelete();
            $table->index(['status', 'held_until']);
        });
    }

    public function down(): void
    {
        DB::table('preorders')->whereIn('status', ['held', 'ordered', 'hold_ended'])->update(['status' => 'arrived']);

        Schema::table('preorders', function (Blueprint $table) {
            $table->dropIndex(['status', 'held_until']);
            $table->dropConstrainedForeignId('order_id');
            $table->dropColumn(['held_until', 'hold_ended_at']);
        });

        Schema::table('product_variants', function (Blueprint $table) {
            $table->dropColumn('preorder_held_pieces');
        });
    }
};
