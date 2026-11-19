<?php

namespace App\Services\Stock;

use App\Models\ProductVariant;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;

/**
 * Where an Item Code's deliveries go in stock: each code is on one size or
 * color (e.g. PRAF01-01-14OZ-BLACK), so what arrives goes into that one.
 */
final class LinkedItems
{
    /**
     * The variant each code is on.
     *
     * @param  iterable<int, string>  $codes
     * @return Collection<string, EloquentCollection<int, ProductVariant>> by Item Code
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
     * Where the code goes into stock and how Head Office sends it.
     *
     * @param  EloquentCollection<int, ProductVariant>  $variants  on the code
     * @return array{product_name: string, variant_label: string, has_options: bool, unit_name: string, pieces_per_unit: int}
     */
    public static function target(EloquentCollection $variants): array
    {
        /** @var ProductVariant $variant */
        $variant = $variants->first();

        return $variant->stockTarget();
    }
}
