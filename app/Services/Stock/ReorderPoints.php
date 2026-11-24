<?php

namespace App\Services\Stock;

use App\Enums\StockMovementType;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\PurchaseOrderItem;
use App\Models\Setting;
use App\Models\StockMovement;
use App\Services\Deliveries\FollowUp;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

/**
 * Each size or color's Reorder Point, the standard way (panel revision):
 *
 *     Reorder Point = pieces used per day × days Head Office takes to deliver + safety stock
 *
 * Pieces used per day are what the variant sold (and gave free) in the last
 * 30 days, divided by 30. The delivery days are a Maintenance setting; the
 * safety stock is the product's "Safety stock" number. When the pieces free to
 * sell fall to the Reorder Point it is time to order more on the eStore, and
 * PROWARE suggests how many: enough to stay above the Reorder Point and last
 * 30 more days and fill the pending back orders, less what is still coming on
 * eStore orders, in whole packs.
 *
 * @phpstan-type ReorderView array{reorder_point: int, used_last_30_days: int, safety_stock: int, lead_days: int, on_order: int, back_ordered: int, suggested: int, status: string, status_label: string, formula: string}
 */
final class ReorderPoints
{
    public const DEFAULT_LEAD_DAYS = 14;

    public const MIN_LEAD_DAYS = 1;

    public const MAX_LEAD_DAYS = 180;

    /** The days of sales a Reorder Point looks back on. */
    public const SALES_DAYS = 30;

    /** The days of sales a suggested order lasts once it arrives. */
    public const COVER_DAYS = 30;

    /** The statuses, in the words shown to the Specialist and the School Admin. */
    public const STATUS_LABELS = [
        'out_of_stock' => 'Out of stock',
        'reorder' => 'Reorder now',
        'on_order' => 'On order',
        'ok' => 'OK',
    ];

    /** Stock movements that are pieces used: sold, given free, and their undoing. */
    private const USED = [
        StockMovementType::Sale,
        StockMovementType::FreePromo,
        StockMovementType::ReleaseUndone,
        StockMovementType::OrderCancelled,
        StockMovementType::ConvertedToHeld,
    ];

    /** The days Head Office takes to deliver an eStore order (Maintenance). */
    public static function leadDays(): int
    {
        $days = Setting::integer(Setting::REORDER_LEAD_DAYS, self::DEFAULT_LEAD_DAYS);

        return $days >= self::MIN_LEAD_DAYS && $days <= self::MAX_LEAD_DAYS ? $days : self::DEFAULT_LEAD_DAYS;
    }

    /**
     * The Reorder Point from the pieces used in the last 30 days, rounded up
     * to whole pieces: 30 used, 14 days, 5 safety stock = 14 + 5 = 19.
     */
    public static function pointFor(int $usedLast30Days, int $safetyStock, ?int $leadDays = null): int
    {
        $lead = $leadDays ?? self::leadDays();

        return (int) ceil($usedLast30Days * $lead / self::SALES_DAYS) + $safetyStock;
    }

    /**
     * Pieces each variant used in the last 30 days, by variant id.
     *
     * @param  list<int>|null  $variantIds  null for every variant
     * @return array<int, int>
     */
    public static function usedLast30Days(?array $variantIds = null): array
    {
        return StockMovement::query()
            ->whereIn('type', self::USED)
            ->where('created_at', '>=', now()->subDays(self::SALES_DAYS))
            ->when($variantIds !== null, fn (Builder $query) => $query->whereIn('product_variant_id', $variantIds))
            ->groupBy('product_variant_id')
            ->selectRaw('product_variant_id, sum(quantity) as change')
            ->pluck('change', 'product_variant_id')
            // Pieces leaving the shelf are negative changes.
            ->map(fn (mixed $change): int => max(0, -(int) $change))
            ->all();
    }

    /**
     * Works out one variant's Reorder Point again, after its stock changed.
     */
    public function refreshVariant(ProductVariant $variant): void
    {
        $variant->loadMissing('product');

        $this->apply($variant, self::usedLast30Days([$variant->id])[$variant->id] ?? 0, self::leadDays());
    }

    /**
     * Works out the Reorder Points again: one product's (after it was saved)
     * or every variant's (each night, and after the delivery days changed).
     * Gives back the variants whose Reorder Point changed.
     *
     * @return Collection<int, ProductVariant>
     */
    public function refreshAll(?Product $product = null): Collection
    {
        $lead = self::leadDays();
        $variants = ProductVariant::query()
            ->with('product')
            ->when($product, fn (Builder $query, Product $only) => $query->where('product_id', $only->id))
            ->get();
        $used = self::usedLast30Days($product === null ? null : $variants->modelKeys());

        return $variants
            ->filter(fn (ProductVariant $variant): bool => $this->apply($variant, $used[$variant->id] ?? 0, $lead))
            ->values();
    }

    /**
     * Saves the variant's new numbers; true when its Reorder Point changed.
     */
    private function apply(ProductVariant $variant, int $used, int $lead): bool
    {
        $point = self::pointFor($used, $variant->product->low_stock_alert_at, $lead);
        $changed = $variant->reorder_point !== $point;

        if ($changed || $variant->used_last_30_days !== $used) {
            $variant->forceFill(['reorder_point' => $point, 'used_last_30_days' => $used])->save();
        }

        return $changed;
    }

    /**
     * Pieces still coming on eStore orders that are not complete yet, by
     * variant id (an order's units times the pieces in Head Office's pack).
     *
     * @param  iterable<ProductVariant>  $variants
     * @return array<int, int>
     */
    public static function onOrder(iterable $variants): array
    {
        $variants = collect($variants);
        $codes = $variants->pluck('estore_item_code')->filter()->unique()->values()->all();

        if ($codes === []) {
            return [];
        }

        $remaining = PurchaseOrderItem::query()
            ->whereIn('item_code', $codes)
            ->whereIn('purchase_order_id', FollowUp::openOrders()->select('id'))
            ->groupBy('item_code')
            ->selectRaw('item_code, sum(case when quantity_ordered > quantity_delivered then quantity_ordered - quantity_delivered else 0 end) as remaining')
            ->pluck('remaining', 'item_code');

        $pieces = [];

        foreach ($variants as $variant) {
            $units = (int) ($remaining[$variant->estore_item_code] ?? 0);

            if ($units > 0) {
                $variant->loadMissing('estorePack');
                $pieces[$variant->id] = $units * ($variant->estorePack->pieces ?? 1);
            }
        }

        return $pieces;
    }

    /**
     * A variant's Reorder Point, status and suggested order, as shown. Null
     * for a size or color that is not watched: a Draft, or a product not for
     * sale (Draft or Preorder products have no stock yet).
     *
     * @return ReorderView|null
     */
    public static function view(ProductVariant $variant, int $onOrder = 0, int $backOrdered = 0): ?array
    {
        $variant->loadMissing(['product', 'estorePack']);

        if (! LowStockAlerts::isSold($variant->product) || $variant->isDraft()) {
            return null;
        }

        $free = $variant->freeToSell();
        $point = (int) $variant->reorder_point;
        $used = (int) $variant->used_last_30_days;
        $suggested = 0;

        if ($free <= $point) {
            $lasts = (int) ceil($used * self::COVER_DAYS / self::SALES_DAYS);
            // Enough to be above the Reorder Point, last 30 more days and fill the back orders.
            $suggested = max($point + $lasts, $point + 1) + $backOrdered - $free - $onOrder;
            $pack = $variant->estorePack->pieces ?? 1;

            if ($suggested > 0 && $pack > 1) {
                $suggested = (int) ceil($suggested / $pack) * $pack;
            }
        }

        $status = match (true) {
            $free > $point => 'ok',
            $suggested <= 0 => 'on_order',
            $free === 0 => 'out_of_stock',
            default => 'reorder',
        };

        return [
            'reorder_point' => $point,
            'used_last_30_days' => $used,
            'safety_stock' => (int) $variant->product->low_stock_alert_at,
            'lead_days' => self::leadDays(),
            'on_order' => $onOrder,
            'back_ordered' => $backOrdered,
            'suggested' => max(0, $suggested),
            'status' => $status,
            'status_label' => self::STATUS_LABELS[$status],
            'formula' => self::formula($variant),
        ];
    }

    /**
     * How the Reorder Point was worked out, in words: "30 pcs used in the
     * last 30 days (1 a day) × 14 days to deliver + 5 safety stock = 19".
     */
    public static function formula(ProductVariant $variant): string
    {
        $safety = (int) $variant->product->low_stock_alert_at;
        $used = (int) $variant->used_last_30_days;

        if ($used === 0) {
            return 'Nothing used in the last '.self::SALES_DAYS.' days, so the Reorder Point is the safety stock: '.Units::count($safety, 'Piece').'.';
        }

        $perDay = rtrim(rtrim(number_format($used / self::SALES_DAYS, 1), '0'), '.');

        return Units::count($used, 'Piece').' used in the last '.self::SALES_DAYS." days ({$perDay} a day) × "
            .self::leadDays().' days to deliver + '.Units::count($safety, 'Piece').' safety stock = '.Units::count((int) $variant->reorder_point, 'Piece').'.';
    }
}
