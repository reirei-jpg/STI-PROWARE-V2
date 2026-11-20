<?php

namespace App\Actions\Orders;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\ProductVariant;
use App\Models\User;
use App\Notifications\OrderPaid;
use App\Services\Stock\LowStockAlerts;
use App\Services\Stock\Units;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The cashier marks an order Paid after the buyer paid (website or phone,
 * from its issuance slip; panel revision, 20 Nov 2026). First to pay, first
 * served: what is still left of each item is set aside for the buyer now
 * (held pieces), and what is no longer left is marked short, so the buyer
 * pays only for what they get. Nothing left at all: it cannot be paid. A
 * payment is final; the Specialist then releases the items.
 */
class MarkOrderPaid
{
    public function __construct(private LowStockAlerts $lowStockAlerts) {}

    /**
     * What the cashier collects now, without changing anything: each item as
     * many as are left, and the total (for the screen before Mark as paid).
     *
     * @return array{total_centavos: int, short: list<string>}
     */
    public static function preview(Order $order): array
    {
        $order->loadMissing('items');
        $holds = $order->holdsItems();
        $total = 0;
        /** @var list<string> $short */
        $short = [];
        /** @var array<int, int> $taken pieces this order takes, per variant */
        $taken = [];

        foreach ($order->items as $item) {
            $variant = ProductVariant::query()->find($item->product_variant_id);
            $free = ($variant?->freeToSell() ?? 0) - ($taken[$item->product_variant_id] ?? 0) + ($holds ? $item->pieces() : 0);
            $units = min($item->quantity, intdiv(max(0, $free), $item->pieces_per_unit));
            $taken[$item->product_variant_id] = ($taken[$item->product_variant_id] ?? 0) + $units * $item->pieces_per_unit;
            $total += $item->unit_price_centavos * $units;

            if ($units < $item->quantity) {
                $short[] = self::shortText($item->quantity - $units, $item->unit_name, $item->product_name, $item->variant_label);
            }
        }

        return ['total_centavos' => $total, 'short' => $short];
    }

    /**
     * @throws ValidationException when it is not waiting for payment, or nothing of it is left
     */
    public function handle(Order $order, User $cashier): string
    {
        /** @var list<string> $short */
        $short = [];

        DB::transaction(function () use ($order, $cashier, &$short): void {
            $order = Order::query()->with('items')->lockForUpdate()->findOrFail($order->id);
            self::refuseUnless($order->status === OrderStatus::Placed, self::notWaiting($order));
            $holds = $order->holdsItems();

            /** @var array<int, ProductVariant> $variants */
            $variants = [];
            /** @var array<int, int> $given units per item */
            $given = [];

            foreach ($order->items as $item) {
                $variant = $variants[$item->product_variant_id] ??= ProductVariant::query()->with('product')->lockForUpdate()->findOrFail($item->product_variant_id);
                // A paid preorder's pieces are already its own.
                $free = $variant->freeToSell() + ($holds ? $item->pieces() : 0);
                $given[$item->id] = min($item->quantity, intdiv(max(0, $free), $item->pieces_per_unit));

                // Set aside for this buyer now; the next line of the same size sees less.
                if (! $holds) {
                    $variant->held_pieces += $given[$item->id] * $item->pieces_per_unit;
                }
            }

            self::refuseUnless(array_sum($given) > 0, "Nothing of order {$order->number} is left in stock, so it cannot be paid. The buyer can cancel it and order again when it is back.");

            $total = 0;

            foreach ($order->items as $item) {
                $units = $given[$item->id];

                if ($units < $item->quantity) {
                    $short[] = self::shortText($item->quantity - $units, $item->unit_name, $item->product_name, $item->variant_label);
                }

                $item->forceFill([
                    'quantity_short' => $item->quantity - $units,
                    'line_total_centavos' => $item->unit_price_centavos * $units,
                ])->save();
                $total += $item->line_total_centavos;
            }

            foreach ($variants as $variant) {
                $variant->save();
                $this->lowStockAlerts->check($variant);
            }

            $order->forceFill([
                'status' => OrderStatus::Paid,
                'total_centavos' => $total,
                'paid_at' => now(),
                'paid_to' => $cashier->id,
            ])->save();
        });

        $order->refresh();
        $order->student->notify(new OrderPaid($order, $short));

        return "Order {$order->number} is paid: ₱".number_format($order->total_centavos / 100, 2)." from {$order->student->name}. The items are set aside; the buyer gets them at the PROWARE office."
            .($short === [] ? '' : ' Not charged (already sold to buyers who paid first): '.implode(', ', $short).'.');
    }

    /**
     * "Order PW-0042 is already paid." or "… is cancelled, so it cannot be paid."
     */
    public static function notWaiting(Order $order): string
    {
        return match ($order->status) {
            OrderStatus::Paid => "Order {$order->number} is already paid.",
            OrderStatus::PickedUp => "Order {$order->number} has already been paid and released.",
            OrderStatus::Cancelled => "Order {$order->number} is cancelled, so it cannot be paid.",
            OrderStatus::Placed => '',
        };
    }

    /** "2 pcs of STI Lanyard (Blue)". */
    private static function shortText(int $units, string $unitName, string $productName, ?string $variantLabel): string
    {
        return Units::count($units, $unitName).' of '.$productName.($variantLabel ? " ({$variantLabel})" : '');
    }

    /**
     * @throws ValidationException
     */
    private static function refuseUnless(bool $allowed, string $refusal): void
    {
        if (! $allowed) {
            throw ValidationException::withMessages(['order' => $refusal]);
        }
    }
}
