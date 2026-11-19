<?php

namespace App\Services\Sales;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\PurchaseOrderItem;

/**
 * What one piece of a product costs the school: the Unit Price on its
 * latest eStore order, divided by the pieces in the pack Head Office sends
 * it in. With several variants the highest cost is used, so a sale price
 * below it always loses money. Unknown when no variant is linked to an
 * eStore item.
 *
 * A variant whose own code was never ordered uses the product's own Item
 * Code: the one code every size or color shared on the earlier orders.
 */
final class HeadOfficeCost
{
    /**
     * @return int|null centavos per piece
     */
    public function perPiece(Product $product): ?int
    {
        $product->loadMissing('variants.estorePack');

        $linked = $product->variants->filter(fn (ProductVariant $variant): bool => $variant->estore_item_code !== null);

        if ($linked->isEmpty()) {
            return null;
        }

        $latestPrices = self::latestUnitPrices(array_values(array_filter([...$linked->pluck('estore_item_code')->all(), $product->item_code], 'is_string')));

        $costs = $linked
            ->map(fn (ProductVariant $variant): ?int => $latestPrices[$variant->estore_item_code] ?? ($product->item_code === null ? null : $latestPrices[$product->item_code] ?? null))
            ->filter(fn (?int $unitPrice): bool => $unitPrice !== null)
            ->map(fn (int $unitPrice, int $key): int => (int) round($unitPrice / ($linked->get($key)?->estorePack->pieces ?? 1)));

        return $costs->isEmpty() ? null : (int) $costs->max();
    }

    /**
     * The Unit Price of each eStore Item Code on its latest uploaded order.
     *
     * @param  list<string>  $itemCodes
     * @return array<string, int> centavos per eStore unit, by item code
     */
    public static function latestUnitPrices(array $itemCodes): array
    {
        if ($itemCodes === []) {
            return [];
        }

        /** @var array<string, int> */
        return PurchaseOrderItem::query()
            ->whereIn('item_code', $itemCodes)
            ->orderByDesc('id')
            ->get(['item_code', 'unit_price_centavos'])
            ->unique('item_code')
            ->mapWithKeys(fn (PurchaseOrderItem $item): array => [$item->item_code => $item->unit_price_centavos])
            ->all();
    }
}
