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
     * An order with who handled it and whether its pickup can be undone.
     * Expects the items, student and handler to be loaded.
     *
     * @return array<string, mixed>
     */
    public static function row(Order $order): array
    {
        return [
            ...OrderRow::of($order),
            'handled_by' => $order->handler?->name,
            'can_undo_pickup' => HandleOrderBySpecialist::canUndoPickup($order),
        ];
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
