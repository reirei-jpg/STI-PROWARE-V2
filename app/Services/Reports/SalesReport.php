<?php

namespace App\Services\Reports;

use App\Enums\LowerPriceReason;
use App\Enums\OrderStatus;
use App\Enums\StockCorrectionReason;
use App\Enums\StockMovementType;
use App\Models\FreeUniformGroup;
use App\Models\FreeUniformStudent;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\StockMovement;
use App\Services\FreeUniforms\FreeUniformScreens;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

/**
 * The Sales Reports for a period, in four parts:
 * 1. Spent: the uploaded eStore purchase orders and what they cost.
 * 2. Sold: each item sold (released orders) with its Cost (what PROWARE
 *    paid on the eStore order, oldest pieces first), its Price (what the
 *    student paid; on sale when lower than the normal price) and the
 *    Profit.
 * 3. Sold below cost: sales whose Price was lower than their Cost, and how
 *    much was lost.
 * 4. Given free: free uniforms (promo) and what they were worth at Cost
 *    and at Price.
 * Sales without a Cost yet are left out of the profit and counted, so the
 * Specialist can set their price.
 *
 * @phpstan-type FreePiece array{id: int, given_at: string|null, product_name: string, variant_label: string|null, pieces: int, recipient_name: string|null, enrollment_form_number: string|null, cost_centavos: int|null, price_centavos: int}
 * @phpstan-type FreeRow array{key: string, group_id: int|null, given_at: string, names: list<string>, more_names: int, students_count: int, sets: string|null, pieces: int, still_to_give: int, cost_centavos: int, missing_cost_pieces: int, price_centavos: int, given_by: string|null, items: list<FreePiece>}
 * @phpstan-type SoldRow array{key: string, variant_id: int, product_name: string, variant_label: string|null, unit_name: string, pieces_per_unit: int, quantity: int, price_each_centavos: int, normal_each_centavos: int|null, lower_price_reason: string|null, lower_price_label: string|null, cost_each_centavos: int|null, price_total_centavos: int, cost_total_centavos: int|null, profit_centavos: int|null, below_cost: bool, loss_centavos: int, missing_cost_lines: int}
 */
final class SalesReport
{
    /**
     * The numbers at the top.
     *
     * @return array{spent_centavos: int, purchase_orders: int, spent_for_preorders_centavos: int, price_centavos: int, cost_centavos: int, costed_price_centavos: int, profit_centavos: int, orders: int, pieces: int, missing_cost_lines: int, below_cost_lines: int, below_cost_loss_centavos: int, free_pieces: int, free_cost_centavos: int, free_price_centavos: int}
     */
    public static function summary(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $sold = self::soldLines($from, $to)
            ->selectRaw('count(distinct order_items.order_id) as orders')
            ->selectRaw('coalesce(sum((order_items.quantity - order_items.quantity_short) * order_items.pieces_per_unit), 0) as pieces')
            ->selectRaw('coalesce(sum(order_items.line_total_centavos), 0) as price')
            ->selectRaw('coalesce(sum(order_items.cost_centavos), 0) as cost')
            ->selectRaw('coalesce(sum(case when order_items.cost_centavos is not null then order_items.line_total_centavos else 0 end), 0) as costed_price')
            ->selectRaw('coalesce(sum(case when order_items.cost_centavos is null then 1 else 0 end), 0) as missing_cost')
            ->selectRaw('coalesce(sum(case when order_items.cost_centavos > order_items.line_total_centavos then 1 else 0 end), 0) as below_lines')
            ->selectRaw('coalesce(sum(case when order_items.cost_centavos > order_items.line_total_centavos then order_items.cost_centavos - order_items.line_total_centavos else 0 end), 0) as below_loss')
            ->toBase()
            ->first();

        $free = self::givenFree($from, $to)->get();

        return [
            'spent_centavos' => (int) self::purchaseOrders($from, $to)->get()->sum(fn (PurchaseOrder $order): int => self::orderTotal($order)),
            'purchase_orders' => self::purchaseOrders($from, $to)->count(),
            // The part of it ordered for buyers' preorders (POs from before this was tracked count as own orders).
            'spent_for_preorders_centavos' => (int) PurchaseOrderItem::query()
                ->whereIn('purchase_order_id', self::purchaseOrders($from, $to)->select('id'))
                ->where('preorder_quantity', '>', 0)
                ->where('quantity_ordered', '>', 0)
                ->get()
                ->sum(fn (PurchaseOrderItem $item): int => intdiv($item->amount_centavos * (int) $item->preorder_quantity, $item->quantity_ordered)),
            'price_centavos' => (int) ($sold->price ?? 0),
            'cost_centavos' => (int) ($sold->cost ?? 0),
            // The Price of the sales that have a Cost: what Profit is worked out from.
            'costed_price_centavos' => (int) ($sold->costed_price ?? 0),
            'profit_centavos' => (int) ($sold->costed_price ?? 0) - (int) ($sold->cost ?? 0),
            'orders' => (int) ($sold->orders ?? 0),
            'pieces' => (int) ($sold->pieces ?? 0),
            'missing_cost_lines' => (int) ($sold->missing_cost ?? 0),
            'below_cost_lines' => (int) ($sold->below_lines ?? 0),
            'below_cost_loss_centavos' => (int) ($sold->below_loss ?? 0),
            'free_pieces' => (int) $free->sum(fn (StockMovement $movement): int => -$movement->quantity),
            'free_cost_centavos' => (int) $free->sum('cost_centavos'),
            'free_price_centavos' => (int) $free->sum(fn (StockMovement $movement): int => self::freePriceValue($movement)),
        ];
    }

    /**
     * 1. The eStore purchase orders ordered in the period, newest first.
     *
     * @return LengthAwarePaginator<int, array{id: int, order_number: string|null, date_ordered: string, items_count: int, total_centavos: int, uploaded_by: string, quantity_ordered: int, preorder_quantity: int|null}>
     */
    public static function spent(CarbonImmutable $from, CarbonImmutable $to): LengthAwarePaginator
    {
        return self::purchaseOrders($from, $to)
            ->with('uploader')
            ->withCount('items')
            ->withSum('items', 'amount_centavos')
            ->withSum('items', 'quantity_ordered')
            ->withSum('items', 'preorder_quantity')
            ->withCount(['items as untracked_items_count' => fn (Builder $items) => $items->whereNull('preorder_quantity')])
            ->latest('date_ordered')
            ->latest('id')
            ->paginate(20)
            ->withQueryString()
            ->through(fn (PurchaseOrder $order): array => [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'date_ordered' => $order->date_ordered->toDateString(),
                'items_count' => (int) $order->getAttribute('items_count'),
                'total_centavos' => self::orderTotal($order),
                'uploaded_by' => $order->uploader->name,
                'quantity_ordered' => (int) $order->getAttribute('items_sum_quantity_ordered'),
                // How much was for buyers' preorders; null on POs saved before this was tracked.
                'preorder_quantity' => (int) $order->getAttribute('untracked_items_count') > 0 ? null : (int) $order->getAttribute('items_sum_preorder_quantity'),
            ]);
    }

    /**
     * 2 and 3. Each item sold, one row per price it was sold at (so a sale
     * price is its own row), the biggest sales first; searchable by name.
     *
     * @return LengthAwarePaginator<int, SoldRow>
     */
    public static function sold(CarbonImmutable $from, CarbonImmutable $to, ?string $search): LengthAwarePaginator
    {
        return self::soldGroups($from, $to, $search)
            ->orderByDesc('price_total')
            ->orderBy('product_name')
            ->paginate(20)
            ->withQueryString()
            ->through(fn (object $row): array => self::soldRow($row));
    }

    /**
     * Every sold row of the period, for the CSV.
     *
     * @return list<SoldRow>
     */
    public static function allSold(CarbonImmutable $from, CarbonImmutable $to): array
    {
        return array_values(self::soldGroups($from, $to, null)
            ->orderByDesc('price_total')
            ->orderBy('product_name')
            ->get()
            ->map(fn (object $row): array => self::soldRow($row))
            ->all());
    }

    /**
     * Every sale of the period, one row per item of a released order, the
     * oldest first (an 8:15 AM release comes before a 2:30 PM one): for the
     * CSV. Only the pieces handed over count (not those short at release).
     *
     * @return list<array{sold_at: CarbonImmutable, order_number: string|null, buyer: string, product_name: string, variant_label: string|null, set_name: string|null, unit_name: string, quantity: int, pieces: int, price_each_centavos: int, lower_price_label: string|null, price_total_centavos: int, cost_total_centavos: int|null, profit_centavos: int|null}>
     */
    public static function salesLog(CarbonImmutable $from, CarbonImmutable $to): array
    {
        return array_values(self::soldLines($from, $to)
            ->join('users', 'users.id', '=', 'orders.user_id')
            ->whereRaw('order_items.quantity > order_items.quantity_short')
            ->orderBy('orders.picked_up_at')
            ->orderBy('orders.id')
            ->orderBy('order_items.id')
            ->select('order_items.*', 'orders.picked_up_at', 'orders.number as order_number', 'users.name as buyer')
            ->get()
            ->map(function (OrderItem $item): array {
                $normal = $item->normal_unit_price_centavos ?? $item->unit_price_centavos;
                $reason = $normal > $item->unit_price_centavos ? ($item->lower_price_reason ?? LowerPriceReason::Sale) : null;
                $soldAt = $item->getAttribute('picked_up_at');

                return [
                    'sold_at' => CarbonImmutable::parse(is_string($soldAt) || $soldAt instanceof \DateTimeInterface ? $soldAt : 'now'),
                    'order_number' => is_string($item->getAttribute('order_number')) ? $item->getAttribute('order_number') : null,
                    'buyer' => (string) $item->getAttribute('buyer'),
                    'product_name' => $item->product_name,
                    'variant_label' => $item->variant_label,
                    'set_name' => $item->set_name,
                    'unit_name' => $item->unit_name,
                    'quantity' => $item->quantity - $item->quantity_short,
                    'pieces' => ($item->quantity - $item->quantity_short) * $item->pieces_per_unit,
                    'price_each_centavos' => $item->unit_price_centavos,
                    'lower_price_label' => $reason?->label(),
                    'price_total_centavos' => $item->line_total_centavos,
                    'cost_total_centavos' => $item->cost_centavos,
                    'profit_centavos' => $item->cost_centavos === null ? null : $item->line_total_centavos - $item->cost_centavos,
                ];
            })
            ->all());
    }

    /**
     * Best sellers: the products that sold the most pieces in the period
     * (all sizes, colors and prices together), most pieces first, with what
     * they sold for, the Profit of the part with a Cost, and the size or
     * color that sold the most.
     *
     * @return LengthAwarePaginator<int, array{rank: int, product_id: int, product_name: string, pieces: int, price_total_centavos: int, profit_centavos: int|null, top_variant_label: string|null, top_variant_pieces: int}>
     */
    public static function bestSellers(CarbonImmutable $from, CarbonImmutable $to, int $perPage = 20, string $pageName = 'page'): LengthAwarePaginator
    {
        // Pieces short at release (sold to buyers who paid first) were not sold.
        $pieces = '(order_items.quantity - order_items.quantity_short) * order_items.pieces_per_unit';

        $page = self::soldLines($from, $to)
            ->groupBy('order_items.product_id')
            ->select('order_items.product_id')
            ->selectRaw('max(order_items.product_name) as product_name')
            ->selectRaw("sum({$pieces}) as pieces")
            ->selectRaw('sum(order_items.line_total_centavos) as price_total')
            ->selectRaw('coalesce(sum(case when order_items.cost_centavos is not null then order_items.line_total_centavos else 0 end), 0) as costed_price')
            ->selectRaw('coalesce(sum(order_items.cost_centavos), 0) as cost_total')
            ->selectRaw('coalesce(sum(case when order_items.cost_centavos is not null then 1 else 0 end), 0) as costed_lines')
            ->orderByRaw("sum({$pieces}) desc")
            ->orderByRaw('sum(order_items.line_total_centavos) desc')
            ->orderByRaw('max(order_items.product_name)')
            ->paginate($perPage, ['*'], $pageName)
            ->withQueryString();

        $topVariants = self::soldLines($from, $to)
            ->whereIn('order_items.product_id', collect($page->items())->pluck('product_id'))
            ->groupBy('order_items.product_id', 'order_items.variant_label')
            ->select('order_items.product_id', 'order_items.variant_label')
            ->selectRaw("sum({$pieces}) as pieces")
            ->orderByRaw("sum({$pieces}) desc")
            ->get()
            ->groupBy('product_id')
            ->map(fn ($variants) => $variants->first());

        $firstRank = ($page->currentPage() - 1) * $page->perPage() + 1;

        return $page->through(function (OrderItem $row, int $index) use ($topVariants, $firstRank): array {
            /** @var array<string, mixed> $values */
            $values = $row->getAttributes();
            $top = $topVariants->get($row->product_id);
            $topLabel = $top?->getAttribute('variant_label');
            $costed = (int) ($values['costed_lines'] ?? 0) > 0;

            return [
                'rank' => $firstRank + $index,
                'product_id' => (int) $row->product_id,
                'product_name' => (string) ($values['product_name'] ?? ''),
                'pieces' => (int) ($values['pieces'] ?? 0),
                'price_total_centavos' => (int) ($values['price_total'] ?? 0),
                'profit_centavos' => $costed ? (int) ($values['costed_price'] ?? 0) - (int) ($values['cost_total'] ?? 0) : null,
                'top_variant_label' => is_string($topLabel) ? $topLabel : null,
                'top_variant_pieces' => (int) ($top?->getAttribute('pieces') ?? 0),
            ];
        });
    }

    /**
     * 4. Free uniforms given in the period (promo), newest first: one row per
     * Free Uniforms group (its students, sets, pieces and what they were
     * worth). Pieces given one by one before there were groups (Correct
     * Stock) are one row per day, with each piece listed.
     *
     * @return LengthAwarePaginator<int, FreeRow>
     */
    public static function free(CarbonImmutable $from, CarbonImmutable $to): LengthAwarePaginator
    {
        $movements = self::givenFree($from, $to)->with('recorder')->get();
        $groupIdOf = [];

        FreeUniformStudent::query()
            ->whereIn('top_movement_id', $movements->modelKeys())
            ->orWhereIn('pants_movement_id', $movements->modelKeys())
            ->get(['free_uniform_group_id', 'top_movement_id', 'pants_movement_id'])
            ->each(function (FreeUniformStudent $student) use (&$groupIdOf): void {
                foreach ([$student->top_movement_id, $student->pants_movement_id] as $movementId) {
                    if ($movementId !== null) {
                        $groupIdOf[$movementId] = $student->free_uniform_group_id;
                    }
                }
            });

        $rows = $movements
            ->groupBy(fn (StockMovement $movement): string => isset($groupIdOf[$movement->id])
                ? 'group-'.$groupIdOf[$movement->id]
                : 'day-'.$movement->created_at?->toDateString())
            ->map(fn (Collection $pieces, string $key): array => self::freeRow($key, $pieces, $groupIdOf[$pieces->first()?->id] ?? null))
            ->sortByDesc('given_at')
            ->values();

        $page = LengthAwarePaginator::resolveCurrentPage();
        $pageRows = $rows->forPage($page, 20)->values();
        $groups = FreeUniformGroup::query()
            ->with('students.uniformSet')
            ->findMany($pageRows->pluck('group_id')->filter()->all())
            ->keyBy('id');

        // A group's students and sets come from the group itself.
        $pageRows = $pageRows->map(function (array $row) use ($groups): array {
            $group = $row['group_id'] === null ? null : $groups->get($row['group_id']);

            if ($group === null) {
                return $row;
            }

            $names = $group->students->map(fn (FreeUniformStudent $student): string => $student->name);

            return [
                ...$row,
                'names' => array_values($names->take(2)->all()),
                'more_names' => max(0, $names->count() - 2),
                'students_count' => $names->count(),
                'sets' => FreeUniformScreens::setsOf($group->students),
                'still_to_give' => $group->students->sum(fn (FreeUniformStudent $student): int => ($student->top_movement_id === null ? 1 : 0) + ($student->pants_movement_id === null ? 1 : 0)),
            ];
        });

        return new LengthAwarePaginator($pageRows, $rows->count(), 20, $page, [
            'path' => LengthAwarePaginator::resolveCurrentPath(),
            'query' => request()->query(),
        ]);
    }

    /**
     * A group's (or a day's) pieces added up: when, how many, what they were
     * worth, and who gave them. A day's pieces are listed one by one.
     *
     * @param  Collection<int, StockMovement>  $pieces
     * @return FreeRow
     */
    private static function freeRow(string $key, Collection $pieces, ?int $groupId): array
    {
        $recipients = $pieces->map(fn (StockMovement $movement): string => (string) $movement->recipient_name)->filter()->unique()->values();

        return [
            'key' => $key,
            'group_id' => $groupId,
            'given_at' => $pieces->max(fn (StockMovement $movement): string => (string) $movement->created_at?->toIso8601String()),
            'names' => array_values($recipients->take(2)->all()),
            'more_names' => max(0, $recipients->count() - 2),
            'students_count' => $recipients->count(),
            'sets' => null,
            'pieces' => (int) $pieces->sum(fn (StockMovement $movement): int => -$movement->quantity),
            'still_to_give' => 0,
            'cost_centavos' => (int) $pieces->sum('cost_centavos'),
            'missing_cost_pieces' => $pieces->whereNull('cost_centavos')->count(),
            'price_centavos' => (int) $pieces->sum(fn (StockMovement $movement): int => self::freePriceValue($movement)),
            'given_by' => $pieces->map(fn (StockMovement $movement): ?string => $movement->recorder?->name)->filter()->unique()->implode(', ') ?: null,
            'items' => $groupId !== null ? [] : array_values($pieces->sortBy('id')->map(fn (StockMovement $movement): array => [
                'id' => $movement->id,
                'given_at' => $movement->created_at?->toIso8601String(),
                'product_name' => $movement->variant->product->name,
                'variant_label' => $movement->variant->choices === [] ? null : $movement->variant->label(),
                'pieces' => -$movement->quantity,
                'recipient_name' => $movement->recipient_name,
                'enrollment_form_number' => $movement->enrollment_form_number,
                'cost_centavos' => $movement->cost_centavos,
                'price_centavos' => self::freePriceValue($movement),
            ])->all()),
        ];
    }

    /**
     * @return Builder<PurchaseOrder>
     */
    private static function purchaseOrders(CarbonImmutable $from, CarbonImmutable $to): Builder
    {
        return PurchaseOrder::query()
            ->whereDate('date_ordered', '>=', $from->toDateString())
            ->whereDate('date_ordered', '<=', $to->toDateString());
    }

    /**
     * The order's total as uploaded, or its items added up when the eStore
     * email had no total.
     */
    private static function orderTotal(PurchaseOrder $order): int
    {
        return $order->total_amount_centavos ?? (int) ($order->getAttribute('items_sum_amount_centavos') ?? $order->items()->sum('amount_centavos'));
    }

    /**
     * Order lines of the orders released in the period. No columns chosen
     * here: totals pick their own (PostgreSQL refuses * beside sums).
     *
     * @return Builder<OrderItem>
     */
    private static function soldLines(CarbonImmutable $from, CarbonImmutable $to): Builder
    {
        return OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.status', OrderStatus::PickedUp)
            ->whereBetween('orders.picked_up_at', [$from, $to]);
    }

    /**
     * @return Builder<OrderItem>
     */
    private static function soldGroups(CarbonImmutable $from, CarbonImmutable $to, ?string $search): Builder
    {
        // Sales from before the normal price was kept have none; they were
        // sold at their normal price, so they join the same row.
        $normalPrice = 'coalesce(order_items.normal_unit_price_centavos, order_items.unit_price_centavos)';
        // A lower price from before the reason was kept was a sale: it joins the sale's row.
        $reason = "case when {$normalPrice} > order_items.unit_price_centavos then coalesce(order_items.lower_price_reason, 'sale') end";

        return self::soldLines($from, $to)
            ->when($search !== null, fn (Builder $query) => $query->whereLike('order_items.product_name', "%{$search}%"))
            ->groupBy('order_items.product_variant_id', 'order_items.unit_name', 'order_items.pieces_per_unit', 'order_items.unit_price_centavos')
            ->groupByRaw($normalPrice)
            ->groupByRaw($reason)
            ->select('order_items.product_variant_id', 'order_items.unit_name', 'order_items.pieces_per_unit', 'order_items.unit_price_centavos')
            ->selectRaw("{$normalPrice} as normal_unit_price_centavos")
            ->selectRaw("{$reason} as lower_price_reason")
            ->selectRaw('max(order_items.product_name) as product_name')
            ->selectRaw('max(order_items.variant_label) as variant_label')
            ->selectRaw('sum(order_items.quantity - order_items.quantity_short) as quantity')
            ->selectRaw('sum(order_items.line_total_centavos) as price_total')
            ->selectRaw('coalesce(sum(order_items.cost_centavos), 0) as cost_total')
            ->selectRaw('coalesce(sum(case when order_items.cost_centavos is not null then order_items.quantity - order_items.quantity_short else 0 end), 0) as costed_quantity')
            ->selectRaw('coalesce(sum(case when order_items.cost_centavos is null then 1 else 0 end), 0) as missing_cost');
    }

    /**
     * One sold row: the Cost and Price per unit, the totals and the Profit
     * of the part with a Cost.
     *
     * @return SoldRow
     */
    private static function soldRow(object $row): array
    {
        /** @var array<string, mixed> $values */
        $values = $row instanceof OrderItem ? $row->getAttributes() : get_object_vars($row);
        $number = fn (string $key): ?int => is_numeric($values[$key] ?? null) ? (int) $values[$key] : null;

        $priceEach = (int) $number('unit_price_centavos');
        $normalEach = $number('normal_unit_price_centavos');
        $costedQuantity = (int) $number('costed_quantity');
        $costTotal = (int) $number('cost_total');
        $costEach = $costedQuantity > 0 ? (int) round($costTotal / $costedQuantity) : null;
        $profit = $costedQuantity > 0 ? $priceEach * $costedQuantity - $costTotal : null;
        $lowered = $normalEach !== null && $normalEach > $priceEach;
        // Lines from before the reason was kept were only lowered by a sale.
        $reason = $lowered
            ? (LowerPriceReason::tryFrom(is_string($values['lower_price_reason'] ?? null) ? $values['lower_price_reason'] : '') ?? LowerPriceReason::Sale)
            : null;

        return [
            'key' => implode('-', [$number('product_variant_id'), $values['unit_name'] ?? '', $priceEach, $normalEach ?? 'x', $reason->value ?? 'normal']),
            'variant_id' => (int) $number('product_variant_id'),
            'product_name' => is_string($values['product_name'] ?? null) ? $values['product_name'] : '',
            'variant_label' => is_string($values['variant_label'] ?? null) ? $values['variant_label'] : null,
            'unit_name' => is_string($values['unit_name'] ?? null) ? $values['unit_name'] : 'Piece',
            'pieces_per_unit' => (int) ($number('pieces_per_unit') ?? 1),
            'quantity' => (int) $number('quantity'),
            'price_each_centavos' => $priceEach,
            // Shown crossed out when it was sold on sale or at the early-bird price.
            'normal_each_centavos' => $lowered ? $normalEach : null,
            'lower_price_reason' => $reason?->value,
            'lower_price_label' => $reason?->label(),
            'cost_each_centavos' => $costEach,
            'price_total_centavos' => (int) $number('price_total'),
            'cost_total_centavos' => $costedQuantity > 0 ? $costTotal : null,
            'profit_centavos' => $profit,
            'below_cost' => $profit !== null && $profit < 0,
            'loss_centavos' => $profit !== null && $profit < 0 ? -$profit : 0,
            'missing_cost_lines' => (int) $number('missing_cost'),
        ];
    }

    /**
     * Pieces given free (promo) in the period: free uniforms, and the
     * "Given free (promo)" corrections made before the Free Uniforms page.
     *
     * @return Builder<StockMovement>
     */
    private static function givenFree(CarbonImmutable $from, CarbonImmutable $to): Builder
    {
        return self::freeMovements()
            ->with('variant.product')
            ->whereBetween('created_at', [$from, $to]);
    }

    /**
     * Every piece given free (promo), at any time.
     *
     * @return Builder<StockMovement>
     */
    private static function freeMovements(): Builder
    {
        return StockMovement::query()
            ->where(fn (Builder $query) => $query
                ->where('type', StockMovementType::FreePromo)
                ->orWhere(fn (Builder $old) => $old
                    ->where('type', StockMovementType::Correction)
                    ->where('reason', StockCorrectionReason::GivenFree)));
    }

    /**
     * Where "All time" starts: the day of the earliest eStore order,
     * released order or free piece; today when there is nothing yet.
     */
    public static function firstDay(): CarbonImmutable
    {
        $dates = array_filter([
            PurchaseOrder::query()->min('date_ordered'),
            Order::query()->where('status', OrderStatus::PickedUp)->min('picked_up_at'),
            self::freeMovements()->min('created_at'),
        ]);

        if ($dates === []) {
            return CarbonImmutable::today();
        }

        return min(array_map(fn (mixed $date): CarbonImmutable => CarbonImmutable::parse((string) $date)->startOfDay(), $dates));
    }

    /**
     * What free pieces would have sold for at their normal price.
     */
    private static function freePriceValue(StockMovement $movement): int
    {
        return (int) ($movement->variant->normalPiecePrice() ?? 0) * -$movement->quantity;
    }
}
