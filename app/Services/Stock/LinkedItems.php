<?php

namespace App\Services\Stock;

use App\Models\DeliveryItem;
use App\Models\ProductVariant;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;

/**
 * Where an eStore Item Code's deliveries go in stock. A code is on one
 * variant (e.g. Chibi Keychain IT), or shared by several variants of one
 * product (e.g. STI Umbrella in every color): then each delivery is split
 * by variant when it is recorded.
 */
final class LinkedItems
{
    /**
     * The variants each code is on, in the product's order.
     *
     * @param  iterable<int, string>  $codes
     * @return Collection<string, EloquentCollection<int, ProductVariant>> by eStore Item Code
     */
    public static function variantsByCode(iterable $codes, bool $lockForUpdate = false): Collection
    {
        $codes = collect($codes)->unique()->values();

        if ($codes->isEmpty()) {
            return collect();
        }

        $variants = ProductVariant::query()
            ->with(['product', 'estorePack'])
            ->whereIn('estore_item_code', $codes->all())
            ->orderBy('product_id')
            ->orderBy('position')
            ->orderBy('id')
            ->when($lockForUpdate, fn ($query) => $query->lockForUpdate())
            ->get();

        /** @var Collection<string, EloquentCollection<int, ProductVariant>> $byCode */
        $byCode = collect();

        foreach ($variants as $variant) {
            $code = (string) $variant->estore_item_code;
            $byCode->put($code, ($byCode->get($code) ?? new EloquentCollection)->push($variant));
        }

        return $byCode;
    }

    /**
     * Where the code goes into stock and how Head Office sends it. For a
     * shared code, split_into lists the variants to split each delivery
     * into ("split by Color when received").
     *
     * @param  EloquentCollection<int, ProductVariant>  $variants  all on the same code
     * @return array{product_name: string, variant_label: string, has_options: bool, unit_name: string, pieces_per_unit: int, split_into: list<array{id: int, label: string, stock_on_hand: int}>}
     */
    public static function target(EloquentCollection $variants): array
    {
        /** @var ProductVariant $first */
        $first = $variants->first();
        $target = $first->stockTarget();

        if ($variants->count() === 1) {
            return [...$target, 'split_into' => []];
        }

        return [
            ...$target,
            'variant_label' => 'split by '.self::optionNames($first).' when received',
            'split_into' => array_values($variants->map(fn (ProductVariant $variant): array => [
                'id' => $variant->id,
                'label' => $variant->label(),
                'stock_on_hand' => $variant->stock_on_hand,
            ])->all()),
        ];
    }

    /**
     * Shared codes with deliveries that arrived but are not in stock yet,
     * because nobody said how many of each variant came (e.g. received
     * before the code was linked to every variant).
     *
     * @return EloquentCollection<int, DeliveryItem> rows with item_code, units_waiting and description
     */
    public static function waitingToSplit(): EloquentCollection
    {
        $sharedCodes = ProductVariant::query()
            ->whereNotNull('estore_item_code')
            ->groupBy('estore_item_code')
            ->havingRaw('count(*) > 1')
            ->pluck('estore_item_code');

        if ($sharedCodes->isEmpty()) {
            return new EloquentCollection;
        }

        return DeliveryItem::query()
            ->join('purchase_order_items', 'purchase_order_items.id', '=', 'delivery_items.purchase_order_item_id')
            ->whereIn('purchase_order_items.item_code', $sharedCodes->all())
            ->whereDoesntHave('stockMovements')
            ->groupBy('purchase_order_items.item_code')
            ->selectRaw('purchase_order_items.item_code, sum(delivery_items.quantity_received) as units_waiting, max(purchase_order_items.description) as description')
            ->orderBy('purchase_order_items.item_code')
            ->get();
    }

    /**
     * "Color", or "Size / Color" for a product with two options.
     */
    private static function optionNames(ProductVariant $variant): string
    {
        return implode(' / ', array_map(fn (array $choice): string => $choice['option'], $variant->choices));
    }
}
