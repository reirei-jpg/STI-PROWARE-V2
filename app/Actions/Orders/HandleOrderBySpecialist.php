<?php

namespace App\Actions\Orders;

use App\Enums\OrderStatus;
use App\Enums\StockMovementType;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\ProductVariant;
use App\Models\User;
use App\Notifications\OrderReleased;
use App\Services\Stock\LowStockAlerts;
use App\Services\Stock\StockCost;
use App\Services\Stock\Units;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * What the Specialist does with a buyer's order, from the website or the
 * phone app: Release it once the cashier has marked it Paid (panel
 * revision, 20 Nov 2026). The paid items were set aside at payment; now
 * they leave the shelf as a Sale and the buyer is told. Only the buyer can
 * cancel an order, and only before paying. A release is final. Each step
 * answers with what happened, or refuses in words.
 */
class HandleOrderBySpecialist
{
    public function __construct(private LowStockAlerts $lowStockAlerts) {}

    /**
     * Hand the paid items over: what was set aside at payment leaves the
     * shelf now (one Sale per item). What was short at payment was not paid
     * for and is not given.
     *
     * @throws ValidationException when it is not paid yet, or no longer open
     */
    public function release(Order $order, User $specialist): string
    {
        $this->refuseUnless($order->status === OrderStatus::Paid, self::notPaid($order));

        DB::transaction(function () use ($order, $specialist): void {
            $order = Order::query()->with('items')->lockForUpdate()->findOrFail($order->id);
            $this->refuseUnless($order->status === OrderStatus::Paid, self::notPaid($order));

            /** @var array<int, ProductVariant> $variants */
            $variants = [];

            foreach ($order->items as $item) {
                $variant = $variants[$item->product_variant_id] ??= ProductVariant::query()->lockForUpdate()->findOrFail($item->product_variant_id);
                $units = $item->quantity - $item->quantity_short;
                $pieces = $units * $item->pieces_per_unit;

                $variant->stock_on_hand -= $pieces;
                $variant->held_pieces = max(0, $variant->held_pieces - $pieces);

                if ($pieces > 0) {
                    $this->record($variant, StockMovementType::Sale, -$pieces, $variant->stock_on_hand, $item, $specialist, $units);
                }
            }

            foreach ($variants as $variant) {
                $variant->save();
                // What these pieces cost on the eStore, oldest stock first.
                StockCost::replay($variant->id);
                $this->lowStockAlerts->check($variant->load('product'));
            }

            $order->forceFill([
                'status' => OrderStatus::PickedUp,
                'picked_up_at' => now(),
                'handled_by' => $specialist->id,
            ])->save();
        });

        $order->refresh()->load('items');
        $short = array_values($order->items
            ->filter(fn (OrderItem $item): bool => $item->quantity_short > 0)
            ->map(fn (OrderItem $item): string => Units::count($item->quantity_short, $item->unit_name).' of '.$item->product_name.($item->variant_label ? " ({$item->variant_label})" : ''))
            ->all());
        $order->student->notify(new OrderReleased($order, $short));

        return "Order {$order->number} has been released to {$order->student->name}. Paid at the cashier: ₱".number_format($order->total_centavos / 100, 2).'.';
    }

    /**
     * "Order PW-0042 is not paid yet. …", "… has already been released." or
     * "… is cancelled, so it cannot be released."
     */
    public static function notPaid(Order $order): string
    {
        return match ($order->status) {
            OrderStatus::Placed => "Order {$order->number} is not paid yet. The buyer pays at the cashier first; then release it.",
            OrderStatus::PickedUp => "Order {$order->number} has already been released.",
            OrderStatus::Cancelled => "Order {$order->number} is cancelled, so it cannot be released.",
            OrderStatus::Paid => '',
        };
    }

    private function record(ProductVariant $variant, StockMovementType $type, int $pieces, int $balance, OrderItem $item, User $specialist, int $units): void
    {
        $variant->stockMovements()->create([
            'type' => $type,
            'quantity' => $pieces,
            'balance_after' => $balance,
            'order_item_id' => $item->id,
            'units_received' => $units,
            'unit_name' => $item->unit_name,
            'pieces_per_unit' => $item->pieces_per_unit,
            'recorded_by' => $specialist->id,
        ]);
    }

    /**
     * @throws ValidationException
     */
    private function refuseUnless(bool $allowed, string $refusal): void
    {
        if (! $allowed) {
            throw ValidationException::withMessages(['order' => $refusal]);
        }
    }
}
