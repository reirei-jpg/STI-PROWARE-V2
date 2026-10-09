<?php

namespace App\Services\Reports;

use App\Enums\OrderStatus;
use App\Enums\StockCorrectionReason;
use App\Enums\StockMovementType;
use App\Models\OrderItem;
use App\Models\PurchaseOrder;
use App\Models\StockMovement;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;

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
 * @phpstan-type SoldRow array{key: string, variant_id: int, product_name: string, variant_label: string|null, unit_name: string, pieces_per_unit: int, quantity: int, price_each_centavos: int, normal_each_centavos: int|null, cost_each_centavos: int|null, price_total_centavos: int, cost_total_centavos: int|null, profit_centavos: int|null, below_cost: bool, loss_centavos: int, missing_cost_lines: int}
 */
final class SalesReport
{
    /**
     * The numbers at the top.
     *
     * @return array{spent_centavos: int, purchase_orders: int, price_centavos: int, cost_centavos: int, profit_centavos: int, orders: int, pieces: int, missing_cost_lines: int, below_cost_lines: int, below_cost_loss_centavos: int, free_pieces: int, free_cost_centavos: int, free_price_centavos: int}
     */
    public static function summary(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $sold = self::soldLines($from, $to)
            ->selectRaw('count(distinct order_items.order_id) as orders')
            ->selectRaw('coalesce(sum(order_items.quantity * order_items.pieces_per_unit), 0) as pieces')
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
            'price_centavos' => (int) ($sold->price ?? 0),
            'cost_centavos' => (int) ($sold->cost ?? 0),
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
     * @return LengthAwarePaginator<int, array{id: int, order_number: string|null, date_ordered: string, items_count: int, total_centavos: int, uploaded_by: string}>
     */
    public static function spent(CarbonImmutable $from, CarbonImmutable $to): LengthAwarePaginator
    {
        return self::purchaseOrders($from, $to)
            ->with('uploader')
            ->withCount('items')
            ->withSum('items', 'amount_centavos')
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
     * 4. Free uniforms given in the period (promo), the newest first.
     *
     * @return LengthAwarePaginator<int, array{id: int, given_at: string|null, product_name: string, variant_label: string|null, pieces: int, recipient_name: string|null, enrollment_form_number: string|null, cost_centavos: int|null, price_centavos: int, recorded_by: string|null}>
     */
    public static function free(CarbonImmutable $from, CarbonImmutable $to): LengthAwarePaginator
    {
        return self::givenFree($from, $to)
            ->with(['variant.product', 'recorder'])
            ->latest('id')
            ->paginate(20)
            ->withQueryString()
            ->through(fn (StockMovement $movement): array => [
                'id' => $movement->id,
                'given_at' => $movement->created_at?->toIso8601String(),
                'product_name' => $movement->variant->product->name,
                'variant_label' => $movement->variant->choices === [] ? null : $movement->variant->label(),
                'pieces' => -$movement->quantity,
                'recipient_name' => $movement->recipient_name,
                'enrollment_form_number' => $movement->enrollment_form_number,
                'cost_centavos' => $movement->cost_centavos,
                'price_centavos' => self::freePriceValue($movement),
                'recorded_by' => $movement->recorder?->name,
            ]);
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
        return self::soldLines($from, $to)
            ->when($search !== null, fn (Builder $query) => $query->whereLike('order_items.product_name', "%{$search}%"))
            ->groupBy('order_items.product_variant_id', 'order_items.unit_name', 'order_items.pieces_per_unit', 'order_items.unit_price_centavos', 'order_items.normal_unit_price_centavos')
            ->select('order_items.product_variant_id', 'order_items.unit_name', 'order_items.pieces_per_unit', 'order_items.unit_price_centavos', 'order_items.normal_unit_price_centavos')
            ->selectRaw('max(order_items.product_name) as product_name')
            ->selectRaw('max(order_items.variant_label) as variant_label')
            ->selectRaw('sum(order_items.quantity) as quantity')
            ->selectRaw('sum(order_items.line_total_centavos) as price_total')
            ->selectRaw('coalesce(sum(order_items.cost_centavos), 0) as cost_total')
            ->selectRaw('coalesce(sum(case when order_items.cost_centavos is not null then order_items.quantity else 0 end), 0) as costed_quantity')
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

        return [
            'key' => implode('-', [$number('product_variant_id'), $values['unit_name'] ?? '', $priceEach, $normalEach ?? 'x']),
            'variant_id' => (int) $number('product_variant_id'),
            'product_name' => is_string($values['product_name'] ?? null) ? $values['product_name'] : '',
            'variant_label' => is_string($values['variant_label'] ?? null) ? $values['variant_label'] : null,
            'unit_name' => is_string($values['unit_name'] ?? null) ? $values['unit_name'] : 'Piece',
            'pieces_per_unit' => (int) ($number('pieces_per_unit') ?? 1),
            'quantity' => (int) $number('quantity'),
            'price_each_centavos' => $priceEach,
            // Shown crossed out when it was sold on sale.
            'normal_each_centavos' => $normalEach !== null && $normalEach > $priceEach ? $normalEach : null,
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
        return StockMovement::query()
            ->with('variant.product')
            ->where(fn (Builder $query) => $query
                ->where('type', StockMovementType::FreePromo)
                ->orWhere(fn (Builder $old) => $old
                    ->where('type', StockMovementType::Correction)
                    ->where('reason', StockCorrectionReason::GivenFree)))
            ->whereBetween('created_at', [$from, $to]);
    }

    /**
     * What free pieces would have sold for at their normal price.
     */
    private static function freePriceValue(StockMovement $movement): int
    {
        return (int) ($movement->variant->normalPiecePrice() ?? 0) * -$movement->quantity;
    }
}
