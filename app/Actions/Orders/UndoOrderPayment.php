<?php

namespace App\Actions\Orders;

use App\Enums\OrderStatus;
use App\Enums\UserRole;
use App\Models\Order;
use App\Models\Payment;
use App\Models\ProductVariant;
use App\Models\User;
use App\Notifications\PaymentUndone;
use App\Notifications\PaymentUndoneForStaff;
use App\Services\Shop\PaymentRecorder;
use App\Services\Stock\LowStockAlerts;
use App\Services\Stock\RestockedPreorders;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use LogicException;

/**
 * The cashier undoes an order's payment recorded by mistake (the wrong slip
 * was scanned, or the buyer did not pay): only the same day and before the
 * items are released, with a reason. The pieces set aside are for sale again,
 * the order is waiting for payment again at its full amount, and its Payment
 * Receipt stays on record as VOID with the reason. The buyer is told; the
 * Specialist only that it is waiting for payment again.
 */
class UndoOrderPayment
{
    public function __construct(
        private LowStockAlerts $lowStockAlerts,
        private RestockedPreorders $restockedPreorders,
    ) {}

    /**
     * Why its payment cannot be undone now, or null when it can.
     */
    public static function refusal(Order $order): ?string
    {
        return match (true) {
            $order->status === OrderStatus::Placed => "Order {$order->number} has no recorded payment to undo.",
            $order->status === OrderStatus::PickedUp => "Order {$order->number} has already been released, so its payment can no longer be undone.",
            $order->status === OrderStatus::Cancelled => "Order {$order->number} has been cancelled, so there is no payment to undo.",
            $order->holdsItems() => "Order {$order->number} was paid with its preorder slip, so its payment cannot be undone here.",
            PaymentRecorder::standing($order) === null => "Order {$order->number} has no Payment Receipt to void, so its payment cannot be undone here.",
            default => Payment::notToday("order {$order->number}", $order->paid_at),
        };
    }

    /**
     * @throws ValidationException when it is not paid, already released, or paid on another day
     */
    public function handle(Order $order, User $cashier, string $reason): string
    {
        $voided = DB::transaction(function () use ($order, $cashier, $reason): Payment {
            $order = Order::query()->with('items')->lockForUpdate()->findOrFail($order->id);
            $refusal = self::refusal($order);

            if ($refusal !== null) {
                throw ValidationException::withMessages(['order' => $refusal]);
            }

            $payment = PaymentRecorder::standing($order);
            $payment?->void($cashier, $reason);

            foreach ($order->items as $item) {
                // What was set aside at payment is for sale again.
                $pieces = ($item->quantity - $item->quantity_short) * $item->pieces_per_unit;
                $variant = ProductVariant::query()->with('product')->lockForUpdate()->findOrFail($item->product_variant_id);
                $variant->forceFill(['held_pieces' => max(0, $variant->held_pieces - $pieces)])->save();
                $this->lowStockAlerts->check($variant);
                $this->restockedPreorders->check($variant);

                // Waiting for payment again: every piece ordered, at its full amount.
                $item->forceFill([
                    'quantity_short' => 0,
                    'line_total_centavos' => $item->unit_price_centavos * $item->quantity,
                ])->save();
            }

            $order->forceFill([
                'status' => OrderStatus::Placed,
                'total_centavos' => (int) $order->items->sum('line_total_centavos'),
                'paid_at' => null,
                'paid_to' => null,
            ])->save();

            return $payment ?? throw new LogicException('A standing payment was checked above.');
        });

        $order->refresh();
        $order->student->notify(new PaymentUndone($order, $voided->amount_centavos, $reason, $voided->receipt_number));
        Notification::send(User::query()->where('role', UserRole::Specialist)->get(), new PaymentUndoneForStaff($order));

        return "The payment for order {$order->number} (₱".number_format($voided->amount_centavos / 100, 2)." from {$order->student->name}) has been undone. Payment Receipt {$voided->receipt_number} has been voided, and the order is waiting for payment again.";
    }
}
