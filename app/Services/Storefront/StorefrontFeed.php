<?php

namespace App\Services\Storefront;

use App\Enums\ProductStatus;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Database\Eloquent\Builder;

/**
 * The storefront's three sections, for the website and the phone app:
 *
 * - Coming Soon: Preorder products.
 * - On Sale: On Sale products that have stock, the soonest-ending first.
 * - All Merchandise: Available and On Sale products that were ever
 *   received, newest first, sold-out ones last. Products never received
 *   stay hidden, and Draft products are never shown.
 */
final class StorefrontFeed
{
    public const RELATIONS = ['mainPhoto', 'packs', 'variants'];

    /**
     * @return list<array<string, mixed>>
     */
    public static function comingSoon(): array
    {
        return array_values(Product::query()
            ->where('status', ProductStatus::Preorder)
            ->with(self::RELATIONS)
            ->latest('created_at')
            ->latest('id')
            ->limit(20)
            ->get()
            ->map(StorefrontProduct::tile(...))
            ->all());
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function onSale(): array
    {
        return array_values(Product::query()
            ->where('status', ProductStatus::OnSale)
            ->whereHas('variants', fn (Builder $variants) => $variants->whereRaw(ProductVariant::FREE_TO_SELL_SQL.' > 0'))
            ->with(self::RELATIONS)
            ->orderBy('sale_ends_at')
            ->latest('id')
            ->limit(20)
            ->get()
            ->map(StorefrontProduct::tile(...))
            ->all());
    }

    /**
     * All Merchandise, to paginate, optionally by name and in stock / sold
     * out.
     *
     * @param  'in_stock'|'sold_out'|null  $show
     * @return Builder<Product>
     */
    public static function merchandise(?string $search, ?string $show): Builder
    {
        return Product::query()
            ->whereIn('status', [ProductStatus::Available, ProductStatus::OnSale])
            ->whereHas('variants.stockMovements')
            ->with(self::RELATIONS)
            ->when($search, fn (Builder $query, string $name) => $query->whereLike('name', "%{$name}%"))
            ->when($show === 'in_stock', fn (Builder $query) => $query->whereHas('variants', fn (Builder $variants) => $variants->whereRaw(ProductVariant::FREE_TO_SELL_SQL.' > 0')))
            ->when($show === 'sold_out', fn (Builder $query) => $query->whereDoesntHave('variants', fn (Builder $variants) => $variants->whereRaw(ProductVariant::FREE_TO_SELL_SQL.' > 0')))
            ->orderByRaw('case when exists (select 1 from product_variants where product_variants.product_id = products.id and product_variants.stock_on_hand > product_variants.held_pieces) then 0 else 1 end')
            ->latest('created_at')
            ->latest('id');
    }
}
