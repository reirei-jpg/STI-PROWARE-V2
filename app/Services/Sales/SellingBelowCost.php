<?php

namespace App\Services\Sales;

use App\Enums\ProductStatus;
use App\Models\ProductVariant;
use App\Models\PurchaseOrderItem;
use Illuminate\Database\Eloquent\Builder;

/**
 * Products students can buy now for less than one piece cost on the latest
 * eStore order, e.g. a price set before a dearer order arrived. Saving the
 * product or putting it on sale is refused below cost, but a price already
 * set stays until someone changes it, so every sale loses money until then.
 */
final class SellingBelowCost
{
    /**
     * One row per product, its variant furthest below cost, A to Z.
     *
     * @return list<array{product_id: int, product_name: string, variant_label: string|null, price_centavos: int, cost_centavos: int, order_number: string|null}>
     */
    public static function products(): array
    {
        $variants = ProductVariant::query()
            ->whereNotNull('estore_item_code')
            ->whereHas('product', fn (Builder $products) => $products->whereIn('status', [ProductStatus::Available, ProductStatus::OnSale, ProductStatus::Preorder]))
            ->with(['product', 'estorePack'])
            ->get();

        if ($variants->isEmpty()) {
            return [];
        }

        $latestItems = PurchaseOrderItem::query()
            ->with('purchaseOrder')
            ->whereIn('item_code', $variants->pluck('estore_item_code')->unique()->all())
            ->orderByDesc('id')
            ->get()
            ->unique('item_code')
            ->keyBy('item_code');

        $furthestBelow = [];

        foreach ($variants as $variant) {
            $item = $latestItems->get($variant->estore_item_code);
            // Its sale price while On Sale, else its normal price.
            $price = $variant->salePiecePrice() ?? $variant->normalPiecePrice();

            if ($item === null || $price === null) {
                continue;
            }

            $cost = (int) round($item->unit_price_centavos / max(1, $variant->estorePack->pieces ?? 1));
            $gap = $cost - $price;

            if ($gap <= 0 || ($furthestBelow[$variant->product_id]['gap'] ?? 0) >= $gap) {
                continue;
            }

            $furthestBelow[$variant->product_id] = [
                'gap' => $gap,
                'product_id' => $variant->product_id,
                'product_name' => $variant->product->name,
                'variant_label' => $variant->choices === [] ? null : $variant->label(),
                'price_centavos' => $price,
                'cost_centavos' => $cost,
                'order_number' => $item->purchaseOrder->order_number,
            ];
        }

        usort($furthestBelow, fn (array $a, array $b): int => strcasecmp($a['product_name'], $b['product_name']));

        return array_map(function (array $row): array {
            unset($row['gap']);

            return $row;
        }, $furthestBelow);
    }
}
