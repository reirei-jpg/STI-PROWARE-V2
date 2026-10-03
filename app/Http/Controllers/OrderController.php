<?php

namespace App\Http\Controllers;

use App\Actions\Orders\CancelOrder;
use App\Enums\OrderStatus;
use App\Models\Order;
use App\Notifications\OrderReady;
use App\Services\Shop\OrderRow;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The Specialist's Orders page: students' orders to prepare and hand over.
 * Placed → Ready for pickup (the student is told) → Picked up (paid in
 * cash). Any order not picked up yet can be cancelled with a reason; its
 * stock goes back. A pickup marked by mistake can be undone the same day.
 */
class OrderController extends Controller
{
    private const SHOW = ['placed', 'ready', 'picked_up', 'cancelled', 'all'];

    /**
     * Orders by status (New orders by default), with a search by order
     * number or student name. Open orders are sorted by pick-up date, the
     * most urgent first; others newest first.
     */
    public function index(Request $request): Response
    {
        $validated = $request->validate([
            'show' => ['nullable', Rule::in(self::SHOW)],
            'search' => ['nullable', 'string', 'max:120'],
        ]);
        $show = $validated['show'] ?? 'placed';
        $search = trim((string) ($validated['search'] ?? ''));

        $orders = Order::query()
            ->with(['items', 'student', 'handler'])
            ->when($show !== 'all', fn (Builder $query) => $query->where('status', $show))
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $matches) => $matches
                ->whereLike('number', "%{$search}%")
                ->orWhereHas('student', fn (Builder $students) => $students->whereLike('name', "%{$search}%"))))
            ->when(in_array($show, ['placed', 'ready'], true), fn (Builder $query) => $query->orderBy('pick_up_by')->orderBy('id'))
            ->latest('id')
            ->paginate(20)
            ->withQueryString()
            ->through(fn (Order $order): array => [
                ...OrderRow::of($order),
                'handled_by' => $order->handler?->name,
                'can_undo_pickup' => $this->canUndoPickup($order),
            ]);

        $counts = Order::query()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');

        return Inertia::render('orders/index', [
            'orders' => $orders,
            'filters' => ['show' => $show, 'search' => $search === '' ? null : $search],
            'counts' => [
                'placed' => (int) ($counts[OrderStatus::Placed->value] ?? 0),
                'ready' => (int) ($counts[OrderStatus::Ready->value] ?? 0),
                'picked_up' => (int) ($counts[OrderStatus::PickedUp->value] ?? 0),
                'cancelled' => (int) ($counts[OrderStatus::Cancelled->value] ?? 0),
            ],
        ]);
    }

    /**
     * The order is prepared: the student is told to come and pay.
     */
    public function ready(Request $request, Order $order): RedirectResponse
    {
        if ($order->status !== OrderStatus::Placed) {
            return $this->refuse("Order {$order->number} is {$order->status->label()}, so it cannot be marked ready.");
        }

        $order->forceFill(['status' => OrderStatus::Ready, 'ready_at' => now(), 'handled_by' => $request->user()->id])->save();
        $order->student->notify(new OrderReady($order));

        return $this->done("Order {$order->number} is ready for pickup. {$order->student->name} was notified.");
    }

    /**
     * The student picked the order up and paid in cash.
     */
    public function pickedUp(Request $request, Order $order): RedirectResponse
    {
        if (! $order->status->isOpen()) {
            return $this->refuse("Order {$order->number} is {$order->status->label()}, so it cannot be marked picked up.");
        }

        $order->forceFill(['status' => OrderStatus::PickedUp, 'picked_up_at' => now(), 'handled_by' => $request->user()->id])->save();

        return $this->done("Order {$order->number} picked up · ₱".number_format($order->total_centavos / 100, 2).' paid in cash.');
    }

    /**
     * A pickup marked by mistake goes back to Ready for pickup, the same day.
     */
    public function undoPickup(Order $order): RedirectResponse
    {
        if (! $this->canUndoPickup($order)) {
            return $this->refuse("Order {$order->number}'s pickup can only be undone on the day it was marked.");
        }

        $order->forceFill(['status' => OrderStatus::Ready, 'picked_up_at' => null])->save();

        return $this->done("Order {$order->number} is back to Ready for pickup.");
    }

    /**
     * Cancel an order that was not picked up; the stock goes back and the
     * student is told why.
     */
    public function cancel(Request $request, Order $order, CancelOrder $cancelOrder): RedirectResponse
    {
        $validated = $request->validate(
            ['reason' => ['required', 'string', 'max:200']],
            ['reason.required' => 'Write why the order is cancelled. The student will see it.'],
        );

        if (! $order->status->isOpen()) {
            return $this->refuse("Order {$order->number} is {$order->status->label()}, so it cannot be cancelled.");
        }

        $cancelOrder->handle($order, $request->user(), trim($validated['reason']));

        return $this->done("Order {$order->number} was cancelled and its items went back to stock. {$order->student->name} was notified.");
    }

    private function canUndoPickup(Order $order): bool
    {
        return $order->status === OrderStatus::PickedUp && $order->picked_up_at?->isToday() === true;
    }

    private function done(string $message): RedirectResponse
    {
        Inertia::flash('toast', ['type' => 'success', 'message' => $message]);

        return back();
    }

    private function refuse(string $message): RedirectResponse
    {
        Inertia::flash('toast', ['type' => 'error', 'message' => $message]);

        return back();
    }
}
