<?php

namespace App\Actions\Orders;

use App\Enums\OrderStatus;
use App\Enums\StockMovementType;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\ProductVariant;
use App\Models\User;
use App\Notifications\OrderReady;
use App\Services\Stock\StockCost;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * What the Specialist does with a student's order, from the website or the
 * phone app: Placed → Ready for pickup (the student is told) → Released
 * (the issuance slip was scanned, the student paid, and the items left the
 * shelf as a Sale). Any order not released yet can be cancelled with a
 * reason; its hold ends. A release marked by mistake can be undone the same
 * day. Each step answers with what happened, or refuses in words.
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
     * The student paid and received the items: they leave the shelf now
     * (one Sale per item) and the hold ends.
     *
     * @throws ValidationException when it is no longer open
     */
    public function release(Order $order, User $specialist): string
    {
        $this->refuseUnless($order->status->isOpen(), self::notOpen($order, 'released'));

        DB::transaction(function () use ($order, $specialist): void {
            $order = Order::query()->with('items')->lockForUpdate()->findOrFail($order->id);
            $this->refuseUnless($order->status->isOpen(), self::notOpen($order, 'released'));

            foreach ($order->items as $item) {
                $variant = ProductVariant::query()->lockForUpdate()->findOrFail($item->product_variant_id);
                $balance = $variant->stock_on_hand - $item->pieces();

                $variant->forceFill([
                    'stock_on_hand' => $balance,
                    'held_pieces' => max(0, $variant->held_pieces - $item->pieces()),
                ])->save();

                $this->record($variant, StockMovementType::Sale, -$item->pieces(), $balance, $item, $specialist);

                // What these pieces cost on the eStore, oldest stock first.
                StockCost::replay($variant->id);
            }

            $order->forceFill(['status' => OrderStatus::PickedUp, 'picked_up_at' => now(), 'handled_by' => $specialist->id])->save();
        });

        return "Order {$order->number} released to {$order->student->name} · ₱".number_format($order->total_centavos / 100, 2).' paid.';
    }

    /**
     * A release marked by mistake is undone the same day: the items are back
     * on the shelf, held for the order again, and it is Ready for pickup.
     *
     * @throws ValidationException when it was not released today
     */
    public function undoRelease(Order $order, User $specialist): string
    {
        $this->refuseUnless(self::canUndoRelease($order), "Order {$order->number}'s release can only be undone on the day it was released.");

        DB::transaction(function () use ($order, $specialist): void {
            $order = Order::query()->with('items')->lockForUpdate()->findOrFail($order->id);
            $this->refuseUnless(self::canUndoRelease($order), "Order {$order->number}'s release can only be undone on the day it was released.");

            foreach ($order->items as $item) {
                $variant = ProductVariant::query()->lockForUpdate()->findOrFail($item->product_variant_id);
                $balance = $variant->stock_on_hand + $item->pieces();

                $variant->forceFill([
                    'stock_on_hand' => $balance,
                    'held_pieces' => $variant->held_pieces + $item->pieces(),
                ])->save();

                $this->record($variant, StockMovementType::ReleaseUndone, $item->pieces(), $balance, $item, $specialist);
                StockCost::replay($variant->id);
            }

            $order->forceFill(['status' => OrderStatus::Ready, 'picked_up_at' => null])->save();
        });

        return "Order {$order->number} is back to Ready for pickup. Its items are back on the shelf, held for it.";
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

        return "Order {$order->number} was cancelled and its items are free to sell again. {$order->student->name} was notified.";
    }

    public static function canUndoRelease(Order $order): bool
    {
        return $order->status === OrderStatus::PickedUp && $order->picked_up_at?->isToday() === true;
    }

    /**
     * "Order PW-0042 is Released, so it cannot be released."
     */
    private static function notOpen(Order $order, string $step): string
    {
        return "Order {$order->number} is {$order->status->label()}, so it cannot be {$step}.";
    }

    private function record(ProductVariant $variant, StockMovementType $type, int $pieces, int $balance, OrderItem $item, User $specialist): void
    {
        $variant->stockMovements()->create([
            'type' => $type,
            'quantity' => $pieces,
            'balance_after' => $balance,
            'order_item_id' => $item->id,
            'units_received' => $item->quantity,
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
