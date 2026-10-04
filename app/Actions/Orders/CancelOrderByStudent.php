<?php

namespace App\Actions\Orders;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * A student cancels their own order, from the website or the phone app,
 * only while it is still Placed. Once the PROWARE office has prepared it,
 * they are asked to talk to the office.
 */
class CancelOrderByStudent
{
    public function __construct(private CancelOrder $cancelOrder) {}

    /**
     * "Order PW-0001 was cancelled." (website and phone app).
     */
    public static function message(Order $order): string
    {
        return "Order {$order->number} was cancelled.";
    }

    /**
     * Why the student cannot cancel the order now; null when they can.
     */
    public static function refusal(Order $order): ?string
    {
        return match ($order->status) {
            OrderStatus::Placed => null,
            OrderStatus::Ready => "Order {$order->number} is already prepared, so it can no longer be cancelled here. Please talk to the PROWARE office.",
            default => "Order {$order->number} is already {$order->status->label()}.",
        };
    }

    /**
     * @throws ValidationException when the order can no longer be cancelled
     */
    public function handle(Order $order, User $student): void
    {
        $refusal = self::refusal($order);

        if ($refusal !== null) {
            throw ValidationException::withMessages(['order' => $refusal]);
        }

        $this->cancelOrder->handle($order, $student, 'Cancelled by the student.');
    }
}
