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
 * phone app: Release it when the buyer shows the cashier's receipt and the
 * issuance slip (the items leave the shelf as a Sale; the buyer is told).
 * Only the buyer can cancel an order. Orders do not hold stock, so whoever pays
 * first gets it: a line with fewer pieces left than ordered is released
 * with what is left, and the rest is marked short. A release is final.
 * Each step answers with what happened, or refuses in words.
 */
class HandleOrderBySpecialist
{
    public function __construct(private LowStockAlerts $lowStockAlerts) {}

    /**
     * The buyer paid: the items leave the shelf now (one Sale per item),
     * as many as are left of each.
     *
     * @throws ValidationException when it is no longer open, or nothing of it is left
     */
    public function release(Order $order, User $specialist): string
    {
        $this->refuseUnless($order->status->isOpen(), self::notOpen($order, 'released'));

        /** @var list<string> $short */
        $short = [];

        DB::transaction(function () use ($order, $specialist, &$short): void {
            $order = Order::query()->with('items')->lockForUpdate()->findOrFail($order->id);
            $this->refuseUnless($order->status->isOpen(), self::notOpen($order, 'released'));
            $holds = $order->holdsItems();

            /** @var array<int, ProductVariant> $variants */
            $variants = [];
            /** @var array<int, int> $given units per item */
            $given = [];
            /** @var array<int, int> $balances stock left after each item */
            $balances = [];

            foreach ($order->items as $item) {
                $variant = $variants[$item->product_variant_id] ??= ProductVariant::query()->lockForUpdate()->findOrFail($item->product_variant_id);
                // Pieces held for this order (from an arrived preorder) are its own.
                $free = $variant->freeToSell() + ($holds ? $item->pieces() : 0);
                $given[$item->id] = min($item->quantity, intdiv($free, $item->pieces_per_unit));
                // The pieces this line takes are no longer free for the next line of the same size.
                $variant->stock_on_hand -= $given[$item->id] * $item->pieces_per_unit;
                $balances[$item->id] = $variant->stock_on_hand;
                $variant->held_pieces = $holds ? max(0, $variant->held_pieces - $item->pieces()) : $variant->held_pieces;
            }

            $this->refuseUnless(array_sum($given) > 0, "Nothing of order {$order->number} is left in stock, so it cannot be released. Wait for a restock, or the buyer can cancel it.");

            $total = 0;

            foreach ($order->items as $item) {
                $variant = $variants[$item->product_variant_id];
                $units = $given[$item->id];
                $pieces = $units * $item->pieces_per_unit;

                if ($units < $item->quantity) {
                    $short[] = Units::count($item->quantity - $units, $item->unit_name).' of '.$item->product_name.($item->variant_label ? " ({$item->variant_label})" : '');
                }

                $item->forceFill([
                    'quantity_short' => $item->quantity - $units,
                    'line_total_centavos' => $item->unit_price_centavos * $units,
                ])->save();
                $total += $item->line_total_centavos;

                if ($pieces > 0) {
                    $this->record($variant, StockMovementType::Sale, -$pieces, $balances[$item->id], $item, $specialist, $units);
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
                'total_centavos' => $total,
                'picked_up_at' => now(),
                'handled_by' => $specialist->id,
            ])->save();
        });

        $order->refresh();
        $order->student->notify(new OrderReleased($order));

        return "Order {$order->number} has been released to {$order->student->name}. Paid at the cashier: ₱".number_format($order->total_centavos / 100, 2).'.'
            .($short === [] ? '' : ' Short (already sold to buyers who paid first): '.implode(', ', $short).'.');
    }

    /**
     * "Order PW-0042 has already been released." or "Order PW-0042 is
     * cancelled, so it cannot be released."
     */
    private static function notOpen(Order $order, string $step): string
    {
        return match ($order->status) {
            OrderStatus::PickedUp => "Order {$order->number} has already been released.",
            OrderStatus::Cancelled => "Order {$order->number} is cancelled, so it cannot be {$step}.",
            default => "Order {$order->number} cannot be {$step} because its status is {$order->status->label()}.",
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
