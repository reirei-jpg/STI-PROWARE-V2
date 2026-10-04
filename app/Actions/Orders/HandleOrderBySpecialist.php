<?php

namespace App\Actions\Orders;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\User;
use App\Notifications\OrderReady;
use Illuminate\Validation\ValidationException;

/**
 * What the Specialist does with a student's order, from the website or the
 * phone app: Placed → Ready for pickup (the student is told) → Picked up
 * (paid in cash). Any order not picked up yet can be cancelled with a
 * reason; its stock goes back. A pickup marked by mistake can be undone the
 * same day. Each step answers with what happened, or refuses in words.
 */
class HandleOrderBySpecialist
{
    public function __construct(private CancelOrder $cancelOrder) {}

    /**
     * The order is prepared: the student is told to come and pay.
     *
     * @throws ValidationException when it is not Placed
     */
    public function ready(Order $order, User $specialist): string
    {
        $this->refuseUnless($order->status === OrderStatus::Placed, "Order {$order->number} is {$order->status->label()}, so it cannot be marked ready.");

        $order->forceFill(['status' => OrderStatus::Ready, 'ready_at' => now(), 'handled_by' => $specialist->id])->save();
        $order->student->notify(new OrderReady($order));

        return "Order {$order->number} is ready for pickup. {$order->student->name} was notified.";
    }

    /**
     * The student picked the order up and paid in cash.
     *
     * @throws ValidationException when it is no longer open
     */
    public function pickedUp(Order $order, User $specialist): string
    {
        $this->refuseUnless($order->status->isOpen(), "Order {$order->number} is {$order->status->label()}, so it cannot be marked picked up.");

        $order->forceFill(['status' => OrderStatus::PickedUp, 'picked_up_at' => now(), 'handled_by' => $specialist->id])->save();

        return "Order {$order->number} picked up · ₱".number_format($order->total_centavos / 100, 2).' paid in cash.';
    }

    /**
     * A pickup marked by mistake goes back to Ready for pickup, the same day.
     *
     * @throws ValidationException when it was not picked up today
     */
    public function undoPickup(Order $order): string
    {
        $this->refuseUnless(self::canUndoPickup($order), "Order {$order->number}'s pickup can only be undone on the day it was marked.");

        $order->forceFill(['status' => OrderStatus::Ready, 'picked_up_at' => null])->save();

        return "Order {$order->number} is back to Ready for pickup.";
    }

    /**
     * Cancel an order that was not picked up; the stock goes back and the
     * student is told why.
     *
     * @throws ValidationException when it is no longer open
     */
    public function cancel(Order $order, User $specialist, string $reason): string
    {
        $this->refuseUnless($order->status->isOpen(), "Order {$order->number} is {$order->status->label()}, so it cannot be cancelled.");

        $this->cancelOrder->handle($order, $specialist, trim($reason));

        return "Order {$order->number} was cancelled and its items went back to stock. {$order->student->name} was notified.";
    }

    public static function canUndoPickup(Order $order): bool
    {
        return $order->status === OrderStatus::PickedUp && $order->picked_up_at?->isToday() === true;
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
