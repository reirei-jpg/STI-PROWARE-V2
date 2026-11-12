<?php

namespace App\Services\Dashboard;

use App\Enums\PreorderStatus;
use App\Enums\ProductStatus;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Setting;
use App\Services\Reports\SalesReport;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\ValidationException;

/**
 * The stock cards on the Specialist's dashboard (website and phone To-do):
 *
 * - Low stock: items at or below their low-stock number, the emptiest first.
 * - Best sellers this month, by pieces sold.
 * - Ready to order: Coming Soon items still taking preorders whose waiting
 *   preorders reached the Maintenance number (20 by default). The
 *   Specialist either closes its preorders so it moves to To order (then
 *   orders it in the eStore and scans the PO), or leaves it: it comes back
 *   once 10 more pieces are preordered.
 *
 * @phpstan-type LowStockRow array{product_id: int, product_name: string, pieces_left: int, out_of_stock: bool, warn_at: int}
 * @phpstan-type BestSellerRow array{product_id: int, product_name: string, pieces: int}
 * @phpstan-type ReadyRow array{product_id: int, product_name: string, pieces: int, preorders_close_on: string|null}
 */
final class StockCards
{
    public const DEFAULT_PREORDERS_BEFORE_ORDERING = 20;

    public const MIN_PREORDERS_BEFORE_ORDERING = 1;

    public const MAX_PREORDERS_BEFORE_ORDERING = 10000;

    /** Leave it hides an item until this many more pieces are preordered. */
    public const MORE_BEFORE_SHOWING_AGAIN = 10;

    /** Rows shown in a card's list; the count says how many there are in all. */
    public const SHOWN = 8;

    /** The Maintenance number: waiting preorders that make an item ready to order. */
    public static function preordersBeforeOrdering(): int
    {
        return max(self::MIN_PREORDERS_BEFORE_ORDERING, min(self::MAX_PREORDERS_BEFORE_ORDERING, Setting::integer(Setting::PREORDERS_BEFORE_ORDERING, self::DEFAULT_PREORDERS_BEFORE_ORDERING)));
    }

    /**
     * @return array{low_stock: array{count: int, items: list<LowStockRow>}, best_sellers: array{from: string, items: list<BestSellerRow>}, ready_to_order: array{threshold: int, count: int, items: list<ReadyRow>}}
     */
    public function all(): array
    {
        return [
            'low_stock' => $this->lowStock(),
            'best_sellers' => $this->bestSellers(),
            'ready_to_order' => $this->readyToOrder(),
        ];
    }

    /**
     * @return array{count: int, items: list<LowStockRow>}
     */
    private function lowStock(): array
    {
        $products = Product::query()
            ->whereIn('status', [ProductStatus::Available, ProductStatus::OnSale])
            ->whereHas('variants', fn (Builder $variants) => $variants->whereRaw(ProductVariant::FREE_TO_SELL_SQL.' <= products.low_stock_alert_at'))
            ->with('variants')
            ->get()
            ->map(fn (Product $product): array => [
                'product_id' => $product->id,
                'product_name' => $product->name,
                'pieces_left' => (int) $product->variants->sum(fn (ProductVariant $variant): int => $variant->freeToSell()),
                'out_of_stock' => $product->variants->every(fn (ProductVariant $variant): bool => $variant->freeToSell() === 0),
                'warn_at' => $product->low_stock_alert_at,
            ])
            ->sortBy([['pieces_left', 'asc'], ['product_name', 'asc']])
            ->values();

        return ['count' => $products->count(), 'items' => array_values($products->take(self::SHOWN)->all())];
    }

    /**
     * @return array{from: string, items: list<BestSellerRow>}
     */
    private function bestSellers(): array
    {
        $from = CarbonImmutable::now()->startOfMonth();
        $page = SalesReport::bestSellers($from, CarbonImmutable::now(), 5, 'best_sellers_page');

        return [
            'from' => $from->toDateString(),
            'items' => array_values(array_map(fn (array $row): array => [
                'product_id' => $row['product_id'],
                'product_name' => $row['product_name'],
                'pieces' => $row['pieces'],
            ], $page->items())),
        ];
    }

    /**
     * @return array{threshold: int, count: int, items: list<ReadyRow>}
     */
    private function readyToOrder(): array
    {
        $threshold = self::preordersBeforeOrdering();

        $products = self::takingPreorders()
            ->withSum(['preorders as pieces_preordered' => fn (Builder $preorders) => $preorders->where('status', PreorderStatus::Active)], 'quantity')
            ->get()
            ->filter(fn (Product $product): bool => self::isReady($product, (int) $product->getAttribute('pieces_preordered'), $threshold))
            ->map(fn (Product $product): array => [
                'product_id' => $product->id,
                'product_name' => $product->name,
                'pieces' => (int) $product->getAttribute('pieces_preordered'),
                'preorders_close_on' => $product->preorders_close_on?->toDateString(),
            ])
            ->sortByDesc('pieces')
            ->values();

        return ['threshold' => $threshold, 'count' => $products->count(), 'items' => array_values($products->take(self::SHOWN)->all())];
    }

    /**
     * Create PO: its preorders close now, so it moves to To order on the
     * Preorders page.
     *
     * @throws ValidationException when it no longer takes preorders
     */
    public static function closeToOrder(Product $product): string
    {
        self::refuseUnlessTakingPreorders($product);

        $pieces = self::piecesPreordered($product);
        $product->forceFill([
            'preorders_close_on' => CarbonImmutable::yesterday()->toDateString(),
            'preorder_alert_left_at' => null,
        ])->save();

        return "Preorders for {$product->name} are closed: ".self::pieces($pieces).' are now in To order on the Preorders page. Order them in the eStore, then scan the PO.';
    }

    /**
     * Leave it: it keeps taking preorders and comes back once 10 more
     * pieces are preordered.
     *
     * @throws ValidationException when it no longer takes preorders
     */
    public static function leave(Product $product): string
    {
        self::refuseUnlessTakingPreorders($product);

        $pieces = self::piecesPreordered($product);
        $product->forceFill(['preorder_alert_left_at' => $pieces])->save();

        return "{$product->name} keeps taking preorders. It shows here again at ".self::pieces($pieces + self::MORE_BEFORE_SHOWING_AGAIN).' preordered.';
    }

    /**
     * @return Builder<Product>
     */
    private static function takingPreorders(): Builder
    {
        return Product::query()
            ->where('status', ProductStatus::Preorder)
            ->where(fn (Builder $open) => $open->whereNull('preorders_close_on')->orWhereDate('preorders_close_on', '>=', now()->toDateString()));
    }

    private static function isReady(Product $product, int $pieces, int $threshold): bool
    {
        return $pieces >= $threshold
            && ($product->preorder_alert_left_at === null || $pieces >= $product->preorder_alert_left_at + self::MORE_BEFORE_SHOWING_AGAIN);
    }

    private static function piecesPreordered(Product $product): int
    {
        return (int) $product->preorders()->where('status', PreorderStatus::Active)->sum('quantity');
    }

    /**
     * @throws ValidationException
     */
    private static function refuseUnlessTakingPreorders(Product $product): void
    {
        if (! $product->acceptsPreorders()) {
            throw ValidationException::withMessages(['product' => "{$product->name} is no longer taking preorders, so there is nothing to change. See it on the Preorders page."]);
        }
    }

    private static function pieces(int $pieces): string
    {
        return $pieces.' '.($pieces === 1 ? 'pc' : 'pcs');
    }
}
