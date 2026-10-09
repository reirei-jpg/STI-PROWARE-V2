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

        $latestPrices = self::latestUnitPrices(array_values(array_filter($linked->pluck('estore_item_code')->all(), 'is_string')));

        $costs = $linked
            ->filter(fn (ProductVariant $variant): bool => isset($latestPrices[$variant->estore_item_code]))
            ->map(fn (ProductVariant $variant): int => (int) round($latestPrices[$variant->estore_item_code] / ($variant->estorePack->pieces ?? 1)));

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
