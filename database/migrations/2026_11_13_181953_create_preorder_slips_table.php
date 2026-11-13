<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * A preorder slip (PR-0001) for each batch of preorders (the sizes
     * placed with one press of Preorder): the buyer pays at the cashier and
     * the Specialist marks it Paid. It is the buyer's proof of payment.
     * Batches still waiting get one now.
     */
    public function up(): void
    {
        Schema::create('preorder_slips', function (Blueprint $table) {
            $table->id();
            $table->string('batch', 36)->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('number', 20)->nullable()->unique();
            $table->string('code', 64)->unique();
            $table->timestamp('paid_at')->nullable();
            $table->foreignId('paid_by')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedBigInteger('paid_centavos')->nullable();
            $table->timestamps();
        });

        $waiting = DB::table('preorders')
            ->where('status', 'active')
            ->groupBy('batch', 'user_id', 'product_id')
            ->selectRaw('batch, user_id, product_id, min(created_at) as created_at')
            ->orderByRaw('min(id)')
            ->get();

        foreach ($waiting as $batch) {
            $id = DB::table('preorder_slips')->insertGetId([
                'batch' => $batch->batch,
                'user_id' => $batch->user_id,
                'product_id' => $batch->product_id,
                'code' => Str::random(32),
                'created_at' => $batch->created_at,
                'updated_at' => now(),
            ]);
            DB::table('preorder_slips')->where('id', $id)->update(['number' => 'PR-'.str_pad((string) $id, 4, '0', STR_PAD_LEFT)]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('preorder_slips');
    }
};
