<?php

namespace App\Actions\Orders;

use App\Enums\OrderStatus;
use App\Enums\UserRole;
use App\Models\Order;
use App\Models\Payment;
use App\Models\ProductVariant;
use App\Models\User;
use App\Notifications\OrderPaid;
use App\Notifications\PaymentRecorded;
use App\Services\Shop\PaymentRecorder;
use App\Services\Shop\PaymentTender;
use App\Services\Stock\LowStockAlerts;
use App\Services\Stock\Units;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

/**
 * The cashier marks an order Paid after the buyer paid (website or phone,
 * from its issuance slip; panel revision, 20 Nov 2026). First to pay, first
 * served: what is still left of each item is set aside for the buyer now
 * (held pieces), and what is no longer left is marked short, so the buyer
 * pays only for what they get. Nothing left at all: it cannot be paid. The
 * Specialist is told and releases the items; a payment recorded by mistake
 * can be undone by the cashier the same day, before release (UndoOrderPayment).
 */
class MarkOrderPaid
{
    /** The payment (and its receipt) recorded by the last handle(). */
    public ?Payment $payment = null;

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
     * @throws ValidationException when it is not waiting for payment, nothing of it is left, the cash does not cover it, or the GCash reference was used
     */
    public function handle(Order $order, User $cashier, PaymentTender $tender): string
    {
        /** @var list<string> $short */
        $short = [];

        $this->payment = DB::transaction(function () use ($order, $cashier, $tender, &$short): Payment {
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

            self::refuseUnless(array_sum($given) > 0, "None of the items in order {$order->number} are in stock, so the payment cannot be accepted. The buyer may cancel the order and place it again once the items are restocked.");

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

            // Refused before anything is saved when the cash is short or the GCash reference was used.
            $payment = PaymentRecorder::record($order, $total, $tender, $cashier);

            foreach ($variants as $variant) {
                $variant->save();
                $this->lowStockAlerts->check($variant);
            }

            $order->forceFill([
                'status' => OrderStatus::Paid,
                'total_centavos' => $total,
                'paid_at' => $payment->paid_at,
                'paid_to' => $cashier->id,
            ])->save();

            return $payment;
        });

        $order->refresh();
        $order->student->notify(new OrderPaid($order, $short, $this->payment));
        // The Specialist releases it next (told it is paid, nothing of the cashier's record).
        Notification::send(User::query()->where('role', UserRole::Specialist)->get(), new PaymentRecorded($order));

        return "Order {$order->number}: payment of ₱".number_format($order->total_centavos / 100, 2)." from {$order->student->name} has been recorded. The items are reserved for pickup at the PROWARE office."
            .($short === [] ? '' : ' Not charged (sold out before payment): '.implode(', ', $short).'.');
    }

    /**
     * "Order PW-0042 is already paid." or "… has been cancelled, so the payment cannot be accepted."
     */
    public static function notWaiting(Order $order): string
    {
        return match ($order->status) {
            OrderStatus::Paid => "Order {$order->number} has already been paid.",
            OrderStatus::PickedUp => "Order {$order->number} has already been paid and released.",
            OrderStatus::Cancelled => "Order {$order->number} has been cancelled, so the payment cannot be accepted.",
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
