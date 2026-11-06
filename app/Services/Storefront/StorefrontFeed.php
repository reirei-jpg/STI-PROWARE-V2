<?php

namespace App\Services\Storefront;

use App\Enums\ProductStatus;
use App\Enums\StockMovementType;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;

/**
 * The storefront's three sections, for the website and the phone app:
 *
 * - Coming Soon: Preorder products; one whose stock arrives leaves at once.
 * - On Sale: On Sale products that have stock, the soonest-ending first.
 * - All Merchandise: Available and On Sale products that were ever
 *   received: NEW ones (stock arrived in the last 3 days, newest first),
 *   then those on sale (soonest-ending first), then the rest newest first,
 *   sold-out ones last. Products never received stay hidden, and Draft
 *   products are never shown.
 *
 * The search covers every section: only products whose name matches show.
 * The store pop-up (spotlight) ignores it.
 */
final class StorefrontFeed
{
    public const RELATIONS = ['mainPhoto', 'packs', 'variants'];

    /** How long a size that came back stays in the store pop-up. */
    public const BACK_IN_STOCK_DAYS = 7;

    /** The most products the store pop-up shows. */
    public const SPOTLIGHT_LIMIT = 10;

    /** How long a product is NEW after its stock first arrived. */
    public const NEW_DAYS = 3;

    /** It has a size or color students can buy now. */
    private const IN_STOCK_SQL = 'exists (select 1 from product_variants where product_variants.product_id = products.id and product_variants.stock_on_hand > product_variants.held_pieces)';

    /**
     * @return list<array<string, mixed>>
     */
    public static function comingSoon(?string $search = null): array
    {
        return array_values(Product::query()
            ->where('status', ProductStatus::Preorder)
            ->when($search, fn (Builder $query, string $name) => $query->whereLike('name', "%{$name}%"))
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
    public static function onSale(?string $search = null): array
    {
        return array_values(Product::query()
            ->where('status', ProductStatus::OnSale)
            ->whereHas('variants', fn (Builder $variants) => $variants->whereRaw(ProductVariant::FREE_TO_SELL_SQL.' > 0'))
            ->when($search, fn (Builder $query, string $name) => $query->whereLike('name', "%{$name}%"))
            ->with(self::RELATIONS)
            ->orderBy('sale_ends_at')
            ->latest('id')
            ->limit(20)
            ->get()
            ->map(StorefrontProduct::tile(...))
            ->all());
    }

    /**
     * The store pop-up, shown once per visit like an ad: products with a
     * size that was sold out and came back with a delivery in the last
     * BACK_IN_STOCK_DAYS days (newest first, with those sizes), then what is
     * on sale. Each product shows once, and only while it can be bought.
     *
     * @return list<array{reason: 'back_in_stock'|'on_sale', back_in_stock: list<string>, product: array<string, mixed>}>
     */
    public static function spotlight(): array
    {
        // A delivery that found the shelf empty (nothing was left before it
        // came in) for a size that had stock before: not its first arrival.
        $restocks = StockMovement::query()
            ->where('stock_movements.type', StockMovementType::Delivery)
            ->where('stock_movements.created_at', '>=', now()->subDays(self::BACK_IN_STOCK_DAYS))
            ->whereColumn('stock_movements.balance_after', '<=', 'stock_movements.quantity')
            ->whereExists(fn (QueryBuilder $earlier) => $earlier->from('stock_movements as earlier')
                ->whereColumn('earlier.product_variant_id', 'stock_movements.product_variant_id')
                ->whereColumn('earlier.id', '<', 'stock_movements.id')
                ->where('earlier.balance_after', '>', 0))
            ->join('product_variants', 'product_variants.id', '=', 'stock_movements.product_variant_id')
            ->latest('stock_movements.id')
            ->get(['stock_movements.product_variant_id', 'product_variants.product_id']);

        $products = Product::query()
            ->whereIn('id', $restocks->pluck('product_id')->unique())
            ->whereIn('status', [ProductStatus::Available, ProductStatus::OnSale])
            ->with(self::RELATIONS)
            ->get()
            ->keyBy('id');

        $items = [];

        foreach ($restocks->groupBy('product_id') as $productId => $movements) {
            $product = $products->get($productId);
            $restockedIds = $movements->pluck('product_variant_id')->all();
            $backNow = $product?->variants->filter(
                fn (ProductVariant $variant): bool => in_array($variant->id, $restockedIds, true) && $variant->freeToSell() > 0,
            );

            if ($product === null || $backNow->isEmpty()) {
                continue;
            }

            $items[$product->id] = [
                'reason' => 'back_in_stock',
                'back_in_stock' => array_values($backNow->filter(fn (ProductVariant $variant): bool => $variant->choices !== [])
                    ->map(fn (ProductVariant $variant): string => $variant->label())
                    ->all()),
                'product' => StorefrontProduct::tile($product),
            ];
        }

        foreach (self::onSale() as $tile) {
            $items[$tile['id']] ??= ['reason' => 'on_sale', 'back_in_stock' => [], 'product' => $tile];
        }

        return array_slice(array_values($items), 0, self::SPOTLIGHT_LIMIT);
    }

    /**
     * All Merchandise, to paginate, optionally by name (the search of every
     * section, and $find, typed at All Merchandise) and in stock / sold out.
     *
     * @param  'in_stock'|'sold_out'|null  $show
     * @return Builder<Product>
     */
    public static function merchandise(?string $search, ?string $show, ?string $find = null): Builder
    {
        $now = now();

        return Product::query()
            ->whereIn('status', [ProductStatus::Available, ProductStatus::OnSale])
            ->whereHas('variants.stockMovements')
            ->with(self::RELATIONS)
            ->when($search, fn (Builder $query, string $name) => $query->whereLike('name', "%{$name}%"))
            ->when($find, fn (Builder $query, string $name) => $query->whereLike('name', "%{$name}%"))
            ->when($show === 'in_stock', fn (Builder $query) => $query->whereHas('variants', fn (Builder $variants) => $variants->whereRaw(ProductVariant::FREE_TO_SELL_SQL.' > 0')))
            ->when($show === 'sold_out', fn (Builder $query) => $query->whereDoesntHave('variants', fn (Builder $variants) => $variants->whereRaw(ProductVariant::FREE_TO_SELL_SQL.' > 0')))
            // NEW, then on sale, then the rest; sold out last.
            ->orderByRaw('case when not '.self::IN_STOCK_SQL.' then 3 when new_until > ? then 0 when status = ? then 1 else 2 end', [$now, ProductStatus::OnSale->value])
            ->orderByRaw('case when new_until > ? then new_until end desc', [$now])
            ->orderByRaw('case when status = ? then sale_ends_at end', [ProductStatus::OnSale->value])
            ->latest('created_at')
            ->latest('id');
    }
}
