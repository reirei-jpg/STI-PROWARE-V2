<?php

namespace App\Services\Reports;

use App\Enums\ProductCategory;
use App\Enums\StockMovementType;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use Carbon\CarbonImmutable;

/**
 * Two Sales Reports tabs (panel revision D1), for the period chosen:
 *
 * - By Size, Color, Grade: the pieces released to buyers and what they paid,
 *   grouped by each size, each color and each grade level, with the products
 *   that sold most in each. Items without that option are a "No size" /
 *   "No color" row, so every table adds up to the Sales tab's total.
 * - Stock Trend: pieces received, sold, given free and corrected per day (a
 *   month or less) or per week, and the stock at the end of each, for every
 *   product or one.
 *
 * @phpstan-type OptionRow array{label: string, pieces: int, price_total_centavos: int, share: float, top: string}
 * @phpstan-type TrendRow array{label: string, from: string, received: int, sold: int, free: int, corrections: int, stock_at_end: int}
 */
final class SalesBreakdown
{
    /**
     * @return array{size: list<OptionRow>, color: list<OptionRow>, grade: list<OptionRow>, pieces: int, price_total_centavos: int}
     */
    public static function byOption(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $lines = SalesReport::soldLines($from, $to)
            ->groupBy('order_items.product_variant_id', 'order_items.product_id')
            ->select('order_items.product_variant_id', 'order_items.product_id')
            ->selectRaw('max(order_items.product_name) as product_name')
            ->selectRaw('sum((order_items.quantity - order_items.quantity_short) * order_items.pieces_per_unit) as pieces')
            ->selectRaw('sum(order_items.line_total_centavos) as price_total')
            ->get();

        $variants = ProductVariant::query()->whereIn('id', $lines->pluck('product_variant_id')->filter())->get()->keyBy('id');
        $categories = Product::query()->whereIn('id', $lines->pluck('product_id')->filter())->pluck('category', 'id');
        $groups = ['size' => [], 'color' => [], 'grade' => []];

        foreach ($lines as $line) {
            $variant = $variants->get($line->getAttribute('product_variant_id'));
            $choices = collect($variant?->choices ?? [])->mapWithKeys(fn (array $choice): array => [mb_strtolower($choice['option']) => $choice['choice']]);
            $category = $categories->get($line->getAttribute('product_id'));
            $keys = [
                'size' => $choices->get('size') ?? 'No size',
                'color' => $choices->get('color') ?? $choices->get('colour') ?? 'No color',
                'grade' => self::gradeOf($choices->get('program') ?? $choices->get('grade') ?? $choices->get('grade level'), $category instanceof ProductCategory ? $category : ProductCategory::tryFrom((string) $category)),
            ];

            foreach ($keys as $group => $key) {
                $groups[$group][$key] ??= ['pieces' => 0, 'price' => 0, 'products' => []];
                $groups[$group][$key]['pieces'] += (int) $line->getAttribute('pieces');
                $groups[$group][$key]['price'] += (int) $line->getAttribute('price_total');
                $name = (string) $line->getAttribute('product_name');
                $groups[$group][$key]['products'][$name] = ($groups[$group][$key]['products'][$name] ?? 0) + (int) $line->getAttribute('pieces');
            }
        }

        $pieces = (int) $lines->sum(fn ($line): int => (int) $line->getAttribute('pieces'));

        return [
            'size' => self::rows($groups['size'], $pieces),
            'color' => self::rows($groups['color'], $pieces),
            'grade' => self::rows($groups['grade'], $pieces),
            'pieces' => $pieces,
            'price_total_centavos' => (int) $lines->sum(fn ($line): int => (int) $line->getAttribute('price_total')),
        ];
    }

    /**
     * Grade 11 or 12 from the Program option ("Grade 11 (Senior High)"),
     * College for a program like BSIT or a Tertiary Uniform, Senior High for
     * an SHS Uniform without a grade, else Not grade-specific.
     */
    public static function gradeOf(?string $program, ?ProductCategory $category): string
    {
        if ($program !== null && preg_match('/grade\s*(\d+)/i', $program, $match)) {
            return "Grade {$match[1]}";
        }

        return match (true) {
            $program !== null && preg_match('/^bs|college|tertiary/i', $program) === 1 => 'College',
            $category === ProductCategory::TertiaryUniform => 'College',
            $category === ProductCategory::ShsUniform => 'Senior High',
            default => 'Not grade-specific',
        };
    }

    /**
     * @param  array<string, array{pieces: int, price: int, products: array<string, int>}>  $group
     * @return list<OptionRow>
     */
    private static function rows(array $group, int $allPieces): array
    {
        $rows = [];

        foreach ($group as $label => $numbers) {
            arsort($numbers['products']);
            $top = array_slice($numbers['products'], 0, 3, true);

            $rows[] = [
                'label' => (string) $label,
                'pieces' => $numbers['pieces'],
                'price_total_centavos' => $numbers['price'],
                'share' => $allPieces === 0 ? 0.0 : round($numbers['pieces'] * 100 / $allPieces, 1),
                'top' => implode(', ', array_map(fn (string $name, int $pieces): string => "{$name} {$pieces}", array_keys($top), $top)),
            ];
        }

        usort($rows, fn (array $a, array $b): int => [$b['pieces'], $a['label']] <=> [$a['pieces'], $b['label']]);

        return $rows;
    }

    /**
     * Per day (a period of 31 days or less) or per week (from Monday): pieces
     * received, sold, given free and corrected, and the stock at the end,
     * worked back from the stock on the shelf now. One product, or all.
     *
     * @return array{by: string, rows: list<TrendRow>}
     */
    public static function stockTrend(CarbonImmutable $from, CarbonImmutable $to, ?int $productId = null): array
    {
        $byDay = $from->diffInDays($to) <= 31;
        $variantIds = $productId === null ? null : ProductVariant::query()->where('product_id', $productId)->pluck('id')->all();

        $movements = StockMovement::query()
            ->where('created_at', '>=', $from)
            ->when($variantIds !== null, fn ($query) => $query->whereIn('product_variant_id', $variantIds))
            ->get(['type', 'quantity', 'created_at']);

        $stockNow = (int) ProductVariant::query()
            ->when($variantIds !== null, fn ($query) => $query->whereIn('id', $variantIds))
            ->sum('stock_on_hand');

        // Changes after the period are taken off today's stock to find the stock at its end.
        $afterPeriod = (int) $movements->filter(fn (StockMovement $movement): bool => $movement->created_at > $to)->sum('quantity');
        $stock = $stockNow - $afterPeriod;

        $buckets = [];

        for ($day = $byDay ? $from->startOfDay() : $from->startOfWeek(); $day <= $to; $day = $byDay ? $day->addDay() : $day->addWeek()) {
            $buckets[$day->toDateString()] = ['from' => $day, 'received' => 0, 'sold' => 0, 'free' => 0, 'corrections' => 0, 'change' => 0];
        }

        foreach ($movements as $movement) {
            if ($movement->created_at > $to) {
                continue;
            }

            $key = ($byDay ? CarbonImmutable::parse($movement->created_at)->startOfDay() : CarbonImmutable::parse($movement->created_at)->startOfWeek())->toDateString();

            if (! isset($buckets[$key])) {
                continue;
            }

            $quantity = (int) $movement->quantity;
            $buckets[$key]['change'] += $quantity;

            match ($movement->type) {
                StockMovementType::Delivery => $buckets[$key]['received'] += $quantity,
                StockMovementType::FreePromo => $buckets[$key]['free'] -= $quantity,
                StockMovementType::Correction => $buckets[$key]['corrections'] += $quantity,
                default => $buckets[$key]['sold'] -= $quantity,
            };
        }

        $rows = [];

        foreach (array_reverse($buckets, true) as $bucket) {
            $rows[] = [
                'label' => $byDay ? $bucket['from']->format('M j') : 'Week of '.$bucket['from']->format('M j'),
                'from' => $bucket['from']->toDateString(),
                'received' => $bucket['received'],
                'sold' => $bucket['sold'],
                'free' => $bucket['free'],
                'corrections' => $bucket['corrections'],
                'stock_at_end' => $stock,
            ];
            $stock -= $bucket['change'];
        }

        return ['by' => $byDay ? 'day' : 'week', 'rows' => array_reverse($rows)];
    }
}
