<?php

namespace App\Actions\Orders;

use App\Enums\OrderStatus;
use App\Enums\UserRole;
use App\Models\Order;
use App\Models\ProductVariant;
use App\Models\UndonePayment;
use App\Models\User;
use App\Notifications\PaymentUndone;
use App\Notifications\PaymentUndoneForStaff;
use App\Services\Stock\LowStockAlerts;
use App\Services\Stock\RestockedPreorders;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

/**
 * The cashier undoes an order's payment recorded by mistake (the wrong slip
 * was scanned, or the buyer did not pay): only the same day and before the
 * items are released, with a reason. The pieces set aside are for sale again,
 * the order is waiting for payment again at its full amount, and the payment
 * is kept on record (UndonePayment). The buyer and the Specialist are told.
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
            default => UndonePayment::notToday("order {$order->number}", $order->paid_at),
        };
    }

    /**
     * @throws ValidationException when it is not paid, already released, or paid on another day
     */
    public function handle(Order $order, User $cashier, string $reason): string
    {
        $undone = DB::transaction(function () use ($order, $cashier, $reason): UndonePayment {
            $order = Order::query()->with('items')->lockForUpdate()->findOrFail($order->id);
            $refusal = self::refusal($order);

            if ($refusal !== null) {
                throw ValidationException::withMessages(['order' => $refusal]);
            }

            $undone = UndonePayment::query()->create([
                'order_id' => $order->id,
                'amount_centavos' => $order->total_centavos,
                'paid_at' => $order->paid_at,
                'paid_by' => $order->paid_to,
                'undone_by' => $cashier->id,
                'reason' => $reason,
            ]);

            $total = 0;

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
                $total += $item->line_total_centavos;
            }

            $order->forceFill([
                'status' => OrderStatus::Placed,
                'total_centavos' => $total,
                'paid_at' => null,
                'paid_to' => null,
            ])->save();

            return $undone;
        });

        $order->refresh();
        $order->student->notify(new PaymentUndone($order, $undone->amount_centavos, $reason));
        Notification::send(User::query()->where('role', UserRole::Specialist)->get(), new PaymentUndoneForStaff($undone->load(['order.student', 'undoer'])));

        return "The payment for order {$order->number} (₱".number_format($undone->amount_centavos / 100, 2)." from {$order->student->name}) has been undone. The order is waiting for payment again.";
    }
}
