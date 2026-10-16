<?php

namespace App\Actions\Orders;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * A student cancels their own order, from the website or the phone app,
 * only while it is still Placed, with the reason they picked. Once the PROWARE office has prepared it,
 * they are asked to talk to the office.
 */
class CancelOrderByStudent
{
    public function __construct(private CancelOrder $cancelOrder) {}

    /**
     * "Order PW-0001 has been cancelled." (website and phone app).
     */
    public static function message(Order $order): string
    {
        return "Order {$order->number} has been cancelled.";
    }

    /**
     * Why the student cannot cancel the order now; null when they can.
     */
    public static function refusal(Order $order): ?string
    {
        return match ($order->status) {
            OrderStatus::Placed => null,
            OrderStatus::Ready => "Order {$order->number} has already been prepared, so it can no longer be cancelled here. Contact the PROWARE office.",
            default => "Order {$order->number} cannot be cancelled because its status is {$order->status->label()}.",
        };
    }

    /**
     * @throws ValidationException when the order can no longer be cancelled
     */
    public function handle(Order $order, User $student, string $reason): void
    {
        $refusal = self::refusal($order);

        if ($refusal !== null) {
            throw ValidationException::withMessages(['order' => $refusal]);
        }

        $this->cancelOrder->handle($order, $student, $reason);
    }
}
