<?php

namespace App\Services\Reports;

use App\Enums\OrderStatus;
use App\Models\OrderItem;
use App\Models\ProductVariant;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;

/**
 * The Sales Reports: what the released orders of a period collected, what
 * their pieces cost on the eStore (as on the uploaded purchase orders), the
 * profit, and how much less was collected because items were on sale. Only
 * released orders are sales. Lines without a cost are left out of the cost
 * and profit (and counted, so the Specialist can fix their price); lines
 * placed before normal prices were kept have no discount recorded.
 *
 * @phpstan-type ProductSales array{variant_id: int, product_id: int, product_name: string, variant_label: string|null, pieces: int, sales_centavos: int, cost_centavos: int, costed_sales_centavos: int, uncosted_lines: int, profit_centavos: int, discount_centavos: int, on_sale_pieces: int}
 */
final class SalesReport
{
    /** Releases listed in a product's details popup. */
    public const DETAILS_SHOWN = 100;

    /**
     * The numbers for the cards at the top.
     *
     * @return array{orders: int, pieces: int, sales_centavos: int, cost_centavos: int, costed_sales_centavos: int, profit_centavos: int, margin_percent: float|null, uncosted_lines: int, discount_centavos: int, on_sale_pieces: int, discount_not_recorded_lines: int}
     */
    public static function summary(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $totals = self::lines($from, $to)
            ->selectRaw('count(distinct order_items.order_id) as orders')
            ->selectRaw('coalesce(sum(order_items.quantity * order_items.pieces_per_unit), 0) as pieces')
            ->selectRaw('coalesce(sum(order_items.line_total_centavos), 0) as sales')
            ->selectRaw('coalesce(sum(order_items.cost_centavos), 0) as cost')
            ->selectRaw('coalesce(sum(case when order_items.cost_centavos is not null then order_items.line_total_centavos else 0 end), 0) as costed_sales')
            ->selectRaw('coalesce(sum(case when order_items.cost_centavos is null then 1 else 0 end), 0) as uncosted_lines')
            ->selectRaw(self::DISCOUNT_SQL.' as discount')
            ->selectRaw(self::ON_SALE_PIECES_SQL.' as on_sale_pieces')
            ->selectRaw('coalesce(sum(case when order_items.normal_unit_price_centavos is null then 1 else 0 end), 0) as not_recorded')
            ->toBase()
            ->first();

        $costedSales = (int) ($totals->costed_sales ?? 0);
        $cost = (int) ($totals->cost ?? 0);
        $profit = $costedSales - $cost;

        return [
            'orders' => (int) ($totals->orders ?? 0),
            'pieces' => (int) ($totals->pieces ?? 0),
            'sales_centavos' => (int) ($totals->sales ?? 0),
            'cost_centavos' => $cost,
            'costed_sales_centavos' => $costedSales,
            'profit_centavos' => $profit,
            'margin_percent' => $costedSales > 0 ? round($profit / $costedSales * 100, 1) : null,
            'uncosted_lines' => (int) ($totals->uncosted_lines ?? 0),
            'discount_centavos' => (int) ($totals->discount ?? 0),
            'on_sale_pieces' => (int) ($totals->on_sale_pieces ?? 0),
            'discount_not_recorded_lines' => (int) ($totals->not_recorded ?? 0),
        ];
    }

    /**
     * Sales per product and size or color, the biggest sales first, 20 at a
     * time; searchable by product name.
     *
     * @return LengthAwarePaginator<int, ProductSales>
     */
    public static function byProduct(CarbonImmutable $from, CarbonImmutable $to, ?string $search): LengthAwarePaginator
    {
        return self::grouped($from, $to, $search)
            ->orderByDesc('sales')
            ->orderBy('product_name')
            ->paginate(20)
            ->withQueryString()
            ->through(fn (object $row): array => self::productRow($row));
    }

    /**
     * Every product line of the period, for the CSV export.
     *
     * @return list<ProductSales>
     */
    public static function allByProduct(CarbonImmutable $from, CarbonImmutable $to): array
    {
        return array_values(self::grouped($from, $to, null)
            ->orderByDesc('sales')
            ->orderBy('product_name')
            ->get()
            ->map(fn (object $row): array => self::productRow($row))
            ->all());
    }

    /**
     * One product's (size or color's) releases in the period, the newest
     * first, for its details popup.
     *
     * @return array{product: ProductSales|null, releases: list<array{order_id: int, order_number: string|null, released_at: string|null, student_name: string, quantity: int, unit_name: string, pieces: int, unit_price_centavos: int, normal_unit_price_centavos: int|null, line_total_centavos: int, cost_centavos: int|null, profit_centavos: int|null, on_sale: bool}>, releases_count: int}
     */
    public static function details(int $variantId, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $lines = self::lines($from, $to)->where('order_items.product_variant_id', $variantId);
        $product = self::grouped($from, $to, null)->where('order_items.product_variant_id', $variantId)->toBase()->first();

        return [
            'product' => $product === null ? null : self::productRow($product),
            'releases' => array_values((clone $lines)
                ->select('order_items.*')
                ->with('order.student')
                ->orderByDesc('orders.picked_up_at')
                ->orderByDesc('order_items.id')
                ->limit(self::DETAILS_SHOWN)
                ->get()
                ->map(fn (OrderItem $item): array => [
                    'order_id' => $item->order_id,
                    'order_number' => $item->order->number,
                    'released_at' => $item->order->picked_up_at?->toIso8601String(),
                    'student_name' => $item->order->student->name,
                    'quantity' => $item->quantity,
                    'unit_name' => $item->unit_name,
                    'pieces' => $item->quantity * $item->pieces_per_unit,
                    'unit_price_centavos' => $item->unit_price_centavos,
                    'normal_unit_price_centavos' => $item->normal_unit_price_centavos,
                    'line_total_centavos' => $item->line_total_centavos,
                    'cost_centavos' => $item->cost_centavos,
                    'profit_centavos' => $item->cost_centavos === null ? null : $item->line_total_centavos - $item->cost_centavos,
                    'on_sale' => $item->normal_unit_price_centavos !== null && $item->unit_price_centavos < $item->normal_unit_price_centavos,
                ])
                ->all()),
            'releases_count' => $lines->count(),
        ];
    }

    /**
     * Sizes and colors with pieces in stock that have no eStore price yet.
     *
     * @return list<array{variant_id: int, product_id: int, product_name: string, variant_label: string|null, uncosted_pieces: int}>
     */
    public static function needingPrice(): array
    {
        return array_values(ProductVariant::query()
            ->with('product')
            ->where('uncosted_pieces', '>', 0)
            ->orderByDesc('uncosted_pieces')
            ->limit(50)
            ->get()
            ->map(fn (ProductVariant $variant): array => [
                'variant_id' => $variant->id,
                'product_id' => $variant->product_id,
                'product_name' => $variant->product->name,
                'variant_label' => $variant->choices === [] ? null : $variant->label(),
                'uncosted_pieces' => $variant->uncosted_pieces,
            ])
            ->all());
    }

    /** (normal price − price paid) × quantity, for lines sold on sale. */
    private const DISCOUNT_SQL = 'coalesce(sum(case when order_items.normal_unit_price_centavos > order_items.unit_price_centavos then (order_items.normal_unit_price_centavos - order_items.unit_price_centavos) * order_items.quantity else 0 end), 0)';

    private const ON_SALE_PIECES_SQL = 'coalesce(sum(case when order_items.normal_unit_price_centavos > order_items.unit_price_centavos then order_items.quantity * order_items.pieces_per_unit else 0 end), 0)';

    /**
     * Order lines of the orders released in the period.
     *
     * @return Builder<OrderItem>
     */
    private static function lines(CarbonImmutable $from, CarbonImmutable $to): Builder
    {
        // No columns chosen here: totals pick their own (PostgreSQL refuses
        // order_items.* beside sums), and the details list asks for them.
        return OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.status', OrderStatus::PickedUp)
            ->whereBetween('orders.picked_up_at', [$from, $to]);
    }

    /**
     * @return Builder<OrderItem>
     */
    private static function grouped(CarbonImmutable $from, CarbonImmutable $to, ?string $search): Builder
    {
        return self::lines($from, $to)
            ->when($search !== null, fn (Builder $query) => $query->whereLike('order_items.product_name', "%{$search}%"))
            ->groupBy('order_items.product_variant_id', 'order_items.product_id')
            ->select('order_items.product_variant_id', 'order_items.product_id')
            ->selectRaw('max(order_items.product_name) as product_name')
            ->selectRaw('max(order_items.variant_label) as variant_label')
            ->selectRaw('sum(order_items.quantity * order_items.pieces_per_unit) as pieces')
            ->selectRaw('sum(order_items.line_total_centavos) as sales')
            ->selectRaw('coalesce(sum(order_items.cost_centavos), 0) as cost')
            ->selectRaw('coalesce(sum(case when order_items.cost_centavos is not null then order_items.line_total_centavos else 0 end), 0) as costed_sales')
            ->selectRaw('coalesce(sum(case when order_items.cost_centavos is null then 1 else 0 end), 0) as uncosted_lines')
            ->selectRaw(self::DISCOUNT_SQL.' as discount')
            ->selectRaw(self::ON_SALE_PIECES_SQL.' as on_sale_pieces');
    }

    /**
     * One grouped row (a model or a plain database row) as the page shows it.
     *
     * @return ProductSales
     */
    private static function productRow(object $row): array
    {
        /** @var array<string, mixed> $values */
        $values = $row instanceof OrderItem ? $row->getAttributes() : get_object_vars($row);
        $number = fn (string $key): int => is_numeric($values[$key] ?? null) ? (int) $values[$key] : 0;
        $costedSales = $number('costed_sales');
        $cost = $number('cost');

        return [
            'variant_id' => $number('product_variant_id'),
            'product_id' => $number('product_id'),
            'product_name' => is_string($values['product_name'] ?? null) ? $values['product_name'] : '',
            'variant_label' => is_string($values['variant_label'] ?? null) ? $values['variant_label'] : null,
            'pieces' => $number('pieces'),
            'sales_centavos' => $number('sales'),
            'cost_centavos' => $cost,
            'costed_sales_centavos' => $costedSales,
            'uncosted_lines' => $number('uncosted_lines'),
            'profit_centavos' => $costedSales - $cost,
            'discount_centavos' => $number('discount'),
            'on_sale_pieces' => $number('on_sale_pieces'),
        ];
    }
}
