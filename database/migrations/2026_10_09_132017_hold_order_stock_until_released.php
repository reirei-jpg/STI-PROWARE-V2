<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Orders now HOLD their items until the Specialist releases them; the
     * shelf count only goes down at release. Adds:
     * - product_variants.held_pieces: pieces held for open orders (free to
     *   sell = stock_on_hand - held_pieces);
     * - orders: the issuance slip's QR code, the student's section, when it
     *   expired (not released in time) and when the student was reminded;
     * - users: the student's section, and when the Specialist lifted an
     *   ordering pause.
     *
     * Open orders placed before this already took their pieces off the
     * shelf. They are changed to held: the pieces go back on the shelf
     * count with a "Changed to held" stock record, and count as held.
     */
    public function up(): void
    {
        Schema::table('product_variants', function (Blueprint $table) {
            $table->unsignedInteger('held_pieces')->default(0)->after('stock_on_hand');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->string('slip_code', 40)->nullable()->unique()->after('number');
            $table->string('student_section', 40)->nullable()->after('user_id');
            $table->timestamp('expired_at')->nullable()->after('cancelled_at');
            $table->timestamp('expiry_reminded_at')->nullable()->after('expired_at');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->string('section', 40)->nullable();
            $table->timestamp('ordering_resumed_at')->nullable();
        });

        foreach (DB::table('orders')->whereNull('slip_code')->pluck('id') as $orderId) {
            DB::table('orders')->where('id', $orderId)->update(['slip_code' => Str::random(32)]);
        }

        $this->changeOpenOrdersToHeld();
    }

    private function changeOpenOrdersToHeld(): void
    {
        $items = DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->whereIn('orders.status', ['placed', 'ready'])
            ->orderBy('order_items.id')
            ->get(['order_items.id', 'order_items.product_variant_id', 'order_items.quantity', 'order_items.pieces_per_unit', 'order_items.unit_name', 'orders.user_id']);

        foreach ($items as $item) {
            $pieces = (int) $item->quantity * (int) $item->pieces_per_unit;
            $variant = DB::table('product_variants')->where('id', $item->product_variant_id)->first(['stock_on_hand', 'held_pieces']);

            if ($variant === null) {
                continue;
            }

            $balance = (int) $variant->stock_on_hand + $pieces;

            DB::table('product_variants')->where('id', $item->product_variant_id)->update([
                'stock_on_hand' => $balance,
                'held_pieces' => (int) $variant->held_pieces + $pieces,
            ]);

            DB::table('stock_movements')->insert([
                'product_variant_id' => $item->product_variant_id,
                'type' => 'converted_to_held',
                'quantity' => $pieces,
                'balance_after' => $balance,
                'order_item_id' => $item->id,
                'units_received' => $item->quantity,
                'unit_name' => $item->unit_name,
                'pieces_per_unit' => $item->pieces_per_unit,
                'note' => 'Not released yet: back on the shelf, held for the order.',
                'recorded_by' => $item->user_id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['section', 'ordering_resumed_at']);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropUnique(['slip_code']);
            $table->dropColumn(['slip_code', 'student_section', 'expired_at', 'expiry_reminded_at']);
        });

        Schema::table('product_variants', function (Blueprint $table) {
            $table->dropColumn('held_pieces');
        });
    }
};
