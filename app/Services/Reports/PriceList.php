<?php

namespace App\Services\Reports;

use App\Models\Product;
use App\Models\ProductPack;
use App\Models\ProductVariant;
use App\Models\PurchaseOrderItem;
use Illuminate\Support\Collection;

/**
 * Each product's eStore Unit Price (on its latest eStore order) beside what
 * students pay now, the profit on one piece, and how Head Office's price
 * changed since the order before; and every eStore order of an item with
 * its Unit Price. Shown on Sales Reports > What we sold and its View
 * Details.
 *
 * @phpstan-type PriceRow array{product_id: int, product_name: string, item_code: string|null, unit_name: string, pieces_per_unit: int, unit_price_centavos: int|null, order_number: string|null, date_ordered: string|null, cost_per_piece_centavos: int|null, price_from_centavos: int|null, price_to_centavos: int|null, on_sale: bool, profit_per_piece_centavos: int|null, margin_percent: int|null, below_cost: bool, change_centavos: int|null, previous_order_number: string|null, orders_count: int}
 */
final class PriceList
{
    /**
     * These products' eStore prices, by product id.
     *
     * @param  Collection<int, Product>  $products  with variants.estorePack and packs
     * @return array<int, PriceRow>
     */
    public static function estoreRows(Collection $products): array
    {
        $ordersByCode = self::orderedItems(array_values(array_unique($products->flatMap(fn (Product $product): array => self::codesOf($product))->all())));
        $rows = [];

        foreach ($products as $product) {
            $rows[$product->id] = self::row($product, $ordersByCode);
        }

        return $rows;
    }

    /**
     * One product's eStore orders, newest first, each with its Unit Price,
     * the Cost per piece, and how much it went up or down from the order
     * before it.
     *
     * @return array{product_id: int, product_name: string, item_code: string|null, unit_name: string, pieces_per_unit: int, price_from_centavos: int|null, price_to_centavos: int|null, orders: list<array{purchase_order_id: int, order_number: string|null, date_ordered: string, quantity_ordered: int, unit_price_centavos: int, cost_per_piece_centavos: int, change_centavos: int|null}>}|null
     */
    public static function history(int $productId): ?array
    {
        $product = Product::query()->with(['variants.estorePack', 'packs'])->find($productId);

        if ($product === null) {
            return null;
        }

        $variant = self::linkedVariant($product);
        $piecesPerUnit = max(1, $variant->estorePack->pieces ?? 1);
        $items = self::itemsOf($product, self::orderedItems(self::codesOf($product)));
        $prices = self::studentPrices($product);
        $orders = [];

        foreach ($items as $index => $item) {
            $older = $items[$index + 1] ?? null;
            $orders[] = [
                'purchase_order_id' => $item->purchase_order_id,
                'order_number' => $item->purchaseOrder->order_number,
                'date_ordered' => $item->purchaseOrder->date_ordered->toDateString(),
                'quantity_ordered' => $item->quantity_ordered,
                'unit_price_centavos' => $item->unit_price_centavos,
                'cost_per_piece_centavos' => (int) round($item->unit_price_centavos / $piecesPerUnit),
                'change_centavos' => $older === null ? null : $item->unit_price_centavos - $older->unit_price_centavos,
            ];
        }

        return [
            'product_id' => $product->id,
            'product_name' => $product->name,
            'item_code' => $product->item_code ?? $variant?->estore_item_code,
            'unit_name' => $variant?->estorePack->name ?? 'Piece',
            'pieces_per_unit' => $piecesPerUnit,
            'price_from_centavos' => $prices->min(),
            'price_to_centavos' => $prices->max(),
            'orders' => $orders,

        ];
    }

    /**
     * @param  array<string, list<PurchaseOrderItem>>  $ordersByCode
     * @return PriceRow
     */
    private static function row(Product $product, array $ordersByCode): array
    {
        $variant = self::linkedVariant($product);
        $piecesPerUnit = max(1, $variant->estorePack->pieces ?? 1);
        $items = self::itemsOf($product, $ordersByCode);
        $latest = $items[0] ?? null;
        $previous = $items[1] ?? null;
        $cost = $latest === null ? null : (int) round($latest->unit_price_centavos / $piecesPerUnit);
        $prices = self::studentPrices($product);
        $lowestPrice = $prices->min();
        $profit = $cost === null || $lowestPrice === null ? null : $lowestPrice - $cost;

        return [
            'product_id' => $product->id,
            'product_name' => $product->name,
            'item_code' => $product->item_code ?? $variant?->estore_item_code,
            'unit_name' => $variant?->estorePack->name ?? 'Piece',
            'pieces_per_unit' => $piecesPerUnit,
            'unit_price_centavos' => $latest?->unit_price_centavos,
            'order_number' => $latest?->purchaseOrder->order_number,
            'date_ordered' => $latest?->purchaseOrder->date_ordered->toDateString(),
            'cost_per_piece_centavos' => $cost,
            'price_from_centavos' => $lowestPrice,
            'price_to_centavos' => $prices->max(),
            'on_sale' => $product->isOnSale(),
            'profit_per_piece_centavos' => $profit,
            'margin_percent' => $profit === null || ! $lowestPrice ? null : (int) round($profit * 100 / $lowestPrice),
            'below_cost' => $profit !== null && $profit < 0,
            'change_centavos' => $latest === null || $previous === null ? null : $latest->unit_price_centavos - $previous->unit_price_centavos,
            'previous_order_number' => $previous?->purchaseOrder->order_number,
            'orders_count' => count($items),
        ];
    }

    /**
     * Every code a product's eStore order lines can have: each variant's
     * own, and the product's own (the one code its sizes or colors shared
     * on earlier orders).
     *
     * @return list<string>
     */
    private static function codesOf(Product $product): array
    {
        return array_values(array_unique(array_filter([...$product->variants->pluck('estore_item_code')->all(), $product->item_code], 'is_string')));
    }

    /**
     * The order lines of any of the product's codes, the latest uploaded
     * first.
     *
     * @param  array<string, list<PurchaseOrderItem>>  $ordersByCode
     * @return list<PurchaseOrderItem>
     */
    private static function itemsOf(Product $product, array $ordersByCode): array
    {
        $items = array_merge(...array_map(fn (string $code): array => $ordersByCode[$code] ?? [], self::codesOf($product)));
        usort($items, fn (PurchaseOrderItem $a, PurchaseOrderItem $b): int => $b->id <=> $a->id);

        return $items;
    }

    /**
     * The first variant linked to an eStore Item Code: how Head Office
     * sends the product (by the piece or a pack).
     */
    private static function linkedVariant(Product $product): ?ProductVariant
    {
        return $product->variants->first(fn (ProductVariant $variant): bool => $variant->estore_item_code !== null);
    }

    /**
     * What students pay for one piece now, per size or color: the sale
     * price while On Sale, else the normal price; for a product sold only
     * by the pack, the pack's price divided by its pieces.
     *
     * @return Collection<int, int>
     */
    public static function studentPrices(Product $product): Collection
    {
        if ($product->sold_by_piece) {
            return $product->variants
                ->map(fn (ProductVariant $variant): ?int => $variant->setRelation('product', $product)->salePiecePrice() ?? $variant->normalPiecePrice())
                ->filter(fn (?int $price): bool => $price !== null)
                ->values();
        }

        return $product->packs
            ->filter(fn (ProductPack $pack): bool => $pack->sold_to_students && $pack->price_centavos !== null)
            ->map(fn (ProductPack $pack): int => (int) round((($product->isOnSale() ? $pack->sale_price_centavos : null) ?? (int) $pack->price_centavos) / max(1, $pack->pieces)))
            ->values();
    }

    /**
     * The eStore order lines of these item codes, the latest uploaded
     * first, by code.
     *
     * @param  list<string>  $itemCodes
     * @return array<string, list<PurchaseOrderItem>>
     */
    private static function orderedItems(array $itemCodes): array
    {
        if ($itemCodes === []) {
            return [];
        }

        $byCode = [];

        // The latest uploaded first, like the Cost on the product form and
        // "Selling below cost" on Products (HeadOfficeCost, SellingBelowCost).
        $items = PurchaseOrderItem::query()
            ->with('purchaseOrder')
            ->whereIn('item_code', $itemCodes)
            ->orderByDesc('id')
            ->get();

        foreach ($items as $item) {
            $byCode[$item->item_code][] = $item;
        }

        return $byCode;
    }
}
