<?php

namespace App\Services\Shop;

use App\Actions\Orders\HandleOrderBySpecialist;
use App\Enums\OrderStatus;
use App\Models\Order;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Validation\Rule;

/**
 * The Specialist's list of students' orders (website Orders page and phone
 * app): by status, New orders by default, with a search by order number or
 * student name. Open orders come by pick-up date, the most urgent first;
 * others newest first.
 */
final class SpecialistOrders
{
    public const SHOW = ['placed', 'ready', 'picked_up', 'cancelled', 'all'];

    /**
     * @return array{show: string, search: string|null}
     */
    public static function filters(Request $request): array
    {
        $validated = $request->validate([
            'show' => ['nullable', Rule::in(self::SHOW)],
            'search' => ['nullable', 'string', 'max:120'],
        ]);
        $search = trim((string) ($validated['search'] ?? ''));

        return [
            'show' => $validated['show'] ?? 'placed',
            'search' => $search === '' ? null : $search,
        ];
    }

    /**
     * @return LengthAwarePaginator<int, array<string, mixed>>
     */
    public static function page(string $show, ?string $search): LengthAwarePaginator
    {
        return Order::query()
            ->with(['items', 'student', 'handler'])
            ->when($show !== 'all', fn (Builder $query) => $query->where('status', $show))
            ->when($search !== null, fn (Builder $query) => $query->where(fn (Builder $matches) => $matches
                ->whereLike('number', "%{$search}%")
                ->orWhereHas('student', fn (Builder $students) => $students->whereLike('name', "%{$search}%"))))
            ->when(in_array($show, ['placed', 'ready'], true), fn (Builder $query) => $query->orderBy('pick_up_by')->orderBy('id'))
            ->latest('id')
            ->paginate(20)
            ->withQueryString()
            ->through(self::row(...));
    }

    /**
     * One order as the list shows it, for its View Details popup once it
     * has moved to another tab (e.g. just released). Null when not found.
     *
     * @return array<string, mixed>|null
     */
    public static function one(int $orderId): ?array
    {
        $order = Order::query()->with(['items', 'student', 'handler'])->find($orderId);

        return $order === null ? null : self::row($order);
    }

    /**
     * An order with who handled it and whether its pickup can be undone.
     * Expects the items, student and handler to be loaded.
     *
     * @return array<string, mixed>
     */
    public static function row(Order $order): array
    {
        return [
            ...OrderRow::of($order),
            'status_label' => $order->status->staffLabel(),
            'handled_by' => $order->handler?->name,
            'can_undo_release' => HandleOrderBySpecialist::canUndoRelease($order),
        ];
    }

    /**
     * The order an issuance slip is for, from its QR code (or its order
     * number, e.g. typed as "PW-0042" when there is nothing to scan), with
     * the student's other open orders. Null when it is not a PROWARE slip.
     *
     * @return array{order: array<string, mixed>, slip: array<string, mixed>, other_open_orders: list<array{id: int, number: string|null, status_label: string}>}|null
     */
    public static function bySlip(string $code): ?array
    {
        $code = trim($code);

        if ($code === '') {
            return null;
        }

        $order = Order::query()
            ->with(['items', 'student', 'handler'])
            ->where('slip_code', $code)
            ->orWhere('number', strtoupper($code))
            ->first();

        if ($order === null) {
            return null;
        }

        return [
            'order' => self::row($order),
            'slip' => IssuanceSlip::of($order),
            'other_open_orders' => array_values(Order::query()
                ->open()
                ->where('user_id', $order->user_id)
                ->whereKeyNot($order->id)
                ->orderBy('id')
                ->get()
                ->map(fn (Order $other): array => ['id' => $other->id, 'number' => $other->number, 'status_label' => $other->status->staffLabel()])
                ->all()),
        ];
    }

    /** Orders shown in a dashboard card's popup; the rest are on Student Orders. */
    public const SHOWN_ON_DASHBOARD = 8;

    /**
     * The order cards on the Specialist's dashboard, each with how many
     * orders it has and the first ones for its popup: new orders to
     * prepare and orders ready for pickup (nearest pick-up date first),
     * orders on their last pickup day, and orders released today.
     *
     * @return array<'new'|'ready'|'last_day'|'released_today', array{count: int, orders: list<array<string, mixed>>}>
     */
    public static function dashboardCards(): array
    {
        $today = now()->toDateString();
        $groups = [
            'new' => fn () => Order::query()->where('status', OrderStatus::Placed)->orderBy('pick_up_by')->orderBy('id'),
            'ready' => fn () => Order::query()->where('status', OrderStatus::Ready)->orderBy('pick_up_by')->orderBy('id'),
            'last_day' => fn () => Order::query()->open()->whereDate('pick_up_by', $today)->orderBy('id'),
            'released_today' => fn () => Order::query()->where('status', OrderStatus::PickedUp)->whereDate('picked_up_at', $today)->latest('picked_up_at')->latest('id'),
        ];

        return array_map(fn (callable $orders): array => [
            'count' => $orders()->count(),
            'orders' => array_values($orders()
                ->with(['items', 'student', 'handler'])
                ->limit(self::SHOWN_ON_DASHBOARD)
                ->get()
                ->map(self::row(...))
                ->all()),
        ], $groups);
    }

    /**
     * How many orders there are of each status, for the tabs.
     *
     * @return array{placed: int, ready: int, picked_up: int, cancelled: int}
     */
    public static function counts(): array
    {
        $counts = Order::query()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');

        return [
            'placed' => (int) ($counts[OrderStatus::Placed->value] ?? 0),
            'ready' => (int) ($counts[OrderStatus::Ready->value] ?? 0),
            'picked_up' => (int) ($counts[OrderStatus::PickedUp->value] ?? 0),
            'cancelled' => (int) ($counts[OrderStatus::Cancelled->value] ?? 0),
        ];
    }
}
