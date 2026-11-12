<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Preorders placed with one press of Preorder share a batch (one card
     * on My Preorders); edited_at is when the buyer last changed one.
     * Earlier preorders of the same buyer and item placed in the same
     * second are put in one batch.
     */
    public function up(): void
    {
        Schema::table('preorders', function (Blueprint $table) {
            $table->string('batch', 36)->nullable()->after('order_id')->index();
            $table->timestamp('edited_at')->nullable()->after('batch');
        });

        $batches = [];

        DB::table('preorders')->orderBy('id')->select(['id', 'user_id', 'product_id', 'created_at'])->lazyById()->each(function (object $preorder) use (&$batches): void {
            $key = $preorder->user_id.'|'.$preorder->product_id.'|'.substr((string) $preorder->created_at, 0, 19);
            $batches[$key] ??= (string) Str::uuid();

            DB::table('preorders')->where('id', $preorder->id)->update(['batch' => $batches[$key]]);
        });
    }

    public function down(): void
    {
        Schema::table('preorders', function (Blueprint $table) {
            $table->dropIndex(['batch']);
            $table->dropColumn(['batch', 'edited_at']);
        });
    }
};
