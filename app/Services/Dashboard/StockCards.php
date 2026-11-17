<?php

namespace App\Services\Dashboard;

use App\Enums\ProductStatus;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\Preorders\PreorderSlipList;
use App\Services\Reports\SalesReport;
use App\Services\Stock\Units;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

/**
 * The stock cards on the Specialist's dashboard (website and phone To-do):
 *
 * - Low stock: items at or below their low-stock number, the emptiest first.
 * - Best sellers this month, by pieces sold.
 * - Top buyers: who spent the most in the last 3 months, and telling them
 *   about a product in stock (TopBuyers).
 * - Preorders: slips waiting for their items, the unpaid ones to verify
 *   (PreorderSlipList).
 *
 * @phpstan-type LowStockRow array{product_id: int, product_name: string, pieces_left: int, out_of_stock: bool, warn_at: int, low_sizes: string|null}
 * @phpstan-type BestSellerRow array{product_id: int, product_name: string, pieces: int}
 */
final class StockCards
{
    /** Rows shown in a card's list; the count says how many there are in all. */
    public const SHOWN = 8;

    /**
     * @return array{low_stock: array{count: int, items: list<LowStockRow>}, best_sellers: array{from: string, items: list<BestSellerRow>}, top_buyers: array<string, mixed>, preorder_slips: array{to_verify: int, paid: int, all: int}}
     */
    public function all(): array
    {
        return [
            'low_stock' => $this->lowStock(),
            'best_sellers' => $this->bestSellers(),
            'top_buyers' => TopBuyers::card(),
            'preorder_slips' => PreorderSlipList::counts(),
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
                'low_sizes' => self::lowSizes($product),
            ])
            ->sortBy([['pieces_left', 'asc'], ['product_name', 'asc']])
            ->values();

        return ['count' => $products->count(), 'items' => array_values($products->take(self::SHOWN)->all())];
    }

    /**
     * The sizes or colors that are low, lowest first: "S/M: 1 pc left,
     * A5: none left". Null for a product without options.
     */
    private static function lowSizes(Product $product): ?string
    {
        $low = $product->variants
            ->filter(fn (ProductVariant $variant): bool => $variant->choices !== [] && $variant->freeToSell() <= $product->low_stock_alert_at)
            ->sortBy(fn (ProductVariant $variant): int => $variant->freeToSell())
            ->map(fn (ProductVariant $variant): string => $variant->label().': '.($variant->freeToSell() === 0 ? 'none left' : Units::count($variant->freeToSell(), 'Piece').' left'))
            ->values();

        if ($low->isEmpty()) {
            return null;
        }

        $more = $low->count() - 3;

        return $low->take(3)->implode(', ').($more > 0 ? " and {$more} more" : '');
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
}
