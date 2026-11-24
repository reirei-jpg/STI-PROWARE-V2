<?php

namespace App\Models;

use App\Enums\OrderStatus;
use App\Enums\ProductCategory;
use App\Enums\ProductStatus;
use App\Enums\StockMovementType;
use Carbon\CarbonInterface;
use Closure;
use Database\Factories\ProductFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Carbon;

/**
 * Merchandise the Specialist sells to students through the storefront.
 * Students buy it by the piece (price_centavos is the price per piece), by
 * a pack, or both. A product sold only by the pack has no price per piece.
 *
 * A product is On Sale only through Put on Sale, for a number of days: the
 * sale price per piece (and per pack) applies until sale_ends_at, then it
 * goes back to Available.
 *
 * @property int $id
 * @property string $name
 * @property string|null $item_code the product's own code, e.g. BP-01; its variants' codes start with it (BP-01-S-RED)
 * @property bool $sold_by_piece
 * @property int|null $price_centavos
 * @property int|null $sale_price_centavos
 * @property ProductStatus $status
 * @property ProductCategory|null $category the eStore's category (required on the form)
 * @property int $low_stock_alert_at the safety stock: pieces of each variant always kept, part of its Reorder Point (ReorderPoints); the store says "Only N left" at or below it
 * @property int|null $most_per_buyer the most pieces one buyer can get, all sizes and colors together (null: no limit of its own; ProductBuyerLimit)
 * @property Carbon|null $sale_started_at
 * @property Carbon|null $sale_ends_at
 * @property Carbon|null $sale_ending_notified_at when the "sale ending tomorrow" notice was sent
 * @property Carbon|null $preorders_close_on last day students can preorder a Preorder product; with preorder_pay_from, the last day to pay for preorders
 * @property Carbon|null $preorder_pay_from first day buyers can pay for their preorders (null: no payment dates set yet)
 * @property Carbon|null $expected_arrival_from first day a Preorder product is expected to arrive
 * @property Carbon|null $expected_arrival_to last day a Preorder product is expected to arrive
 * @property int|null $early_bird_price_centavos lower price per piece for the first pieces preordered
 * @property int|null $early_bird_pieces how many pieces get the early-bird price
 * @property Carbon|null $new_until when the NEW tag ends: 3 days after its stock first arrived (null: never had stock)
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['name', 'category', 'item_code', 'sold_by_piece', 'price_centavos', 'sale_price_centavos', 'status', 'low_stock_alert_at', 'most_per_buyer', 'preorders_close_on', 'expected_arrival_from', 'expected_arrival_to', 'early_bird_price_centavos', 'early_bird_pieces'])]
class Product extends Model
{
    /** @use HasFactory<ProductFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'sold_by_piece' => 'boolean',
            'price_centavos' => 'integer',
            'sale_price_centavos' => 'integer',
            'status' => ProductStatus::class,
            'low_stock_alert_at' => 'integer',
            'category' => ProductCategory::class,
            'most_per_buyer' => 'integer',
            'sale_started_at' => 'datetime',
            'sale_ends_at' => 'datetime',
            'sale_ending_notified_at' => 'datetime',
            'preorders_close_on' => 'date',
            'preorder_pay_from' => 'date',
            'expected_arrival_from' => 'date',
            'expected_arrival_to' => 'date',
            'early_bird_price_centavos' => 'integer',
            'early_bird_pieces' => 'integer',
            'new_until' => 'datetime',
        ];
    }

    /**
     * Its stock arrived less than 3 days ago (NEW in the store, saying "New
     * stock is available. Order now.").
     */
    public function isNew(): bool
    {
        return $this->new_until?->isFuture() === true;
    }

    /**
     * On sale right now: marked On Sale and its last day has not passed, even
     * if the timed job has not ended the sale yet.
     */
    public function isOnSale(): bool
    {
        return $this->status === ProductStatus::OnSale
            && ($this->sale_ends_at === null || $this->sale_ends_at->isFuture());
    }

    /**
     * "Nov 14 – Nov 21, 2026" ("Dec 28, 2026 – Jan 4, 2027" across years), or
     * null when no expected arrival is set.
     */
    public function expectedArrivalText(): ?string
    {
        $from = $this->expected_arrival_from;
        $to = $this->expected_arrival_to;

        if ($from === null || $to === null) {
            return null;
        }

        return $from->year === $to->year
            ? $from->format('M j').' – '.$to->format('M j, Y')
            : $from->format('M j, Y').' – '.$to->format('M j, Y');
    }

    /**
     * Students can preorder it: it is a Preorder product and its close date
     * (the last day) has not passed.
     */
    public function acceptsPreorders(): bool
    {
        return $this->status === ProductStatus::Preorder
            && ($this->preorders_close_on === null || ! $this->preorders_close_on->endOfDay()->isPast());
    }

    /**
     * @return HasMany<Preorder, $this>
     */
    public function preorders(): HasMany
    {
        return $this->hasMany(Preorder::class);
    }

    /**
     * @return HasMany<ProductPhoto, $this>
     */
    public function photos(): HasMany
    {
        return $this->hasMany(ProductPhoto::class)->orderBy('position');
    }

    /**
     * The first photo, shown on the storefront tile.
     *
     * @return HasOne<ProductPhoto, $this>
     */
    public function mainPhoto(): HasOne
    {
        return $this->hasOne(ProductPhoto::class)->oldestOfMany('position');
    }

    /**
     * @return HasMany<ProductOption, $this>
     */
    public function options(): HasMany
    {
        return $this->hasMany(ProductOption::class)->orderBy('position');
    }

    /**
     * @return HasMany<ProductVariant, $this>
     */
    public function variants(): HasMany
    {
        return $this->hasMany(ProductVariant::class)->orderBy('position');
    }

    /**
     * @return HasMany<ProductPack, $this>
     */
    public function packs(): HasMany
    {
        return $this->hasMany(ProductPack::class)->orderBy('position');
    }

    /**
     * Products students can buy now (Available or On Sale) with a variant
     * at or below its Reorder Point (Out of stock included).
     *
     * @param  Builder<self>  $query
     */
    #[Scope]
    protected function lowOnStock(Builder $query): void
    {
        $query->whereIn('status', [ProductStatus::Available, ProductStatus::OnSale])
            ->whereHas('variants', fn (Builder $variants) => $variants->atReorderPoint());
    }

    /**
     * Products in the store with a size or color to reorder: some pieces
     * left, at or below its Reorder Point, but not none (those are Out of
     * stock, see soldOut).
     *
     * @param  Builder<self>  $query
     */
    #[Scope]
    protected function lowButNotOut(Builder $query): void
    {
        $query->whereIn('status', [ProductStatus::Available, ProductStatus::OnSale])
            ->whereHas('variants', fn (Builder $variants) => $variants->lowOnShelf());
    }

    /**
     * Products in the store with a size or color that has nothing left to
     * sell.
     *
     * @param  Builder<self>  $query
     */
    #[Scope]
    protected function soldOut(Builder $query): void
    {
        $query->whereIn('status', [ProductStatus::Available, ProductStatus::OnSale])
            ->whereHas('variants', fn (Builder $variants) => $variants->nothingLeft());
    }

    /**
     * Available products with stock that first arrived at least $days ago
     * and sold nothing in the last $days: candidates for Put on Sale. A sale
     * is an order placed for it that was not cancelled.
     *
     * @param  Builder<self>  $query
     */
    #[Scope]
    protected function slowMoving(Builder $query, int $days): void
    {
        $this->slowMovingSince($query, now()->subDays($days));
    }

    /**
     * Available products with stock that arrived before $since and sold
     * nothing since then.
     *
     * @param  Builder<self>  $query
     */
    #[Scope]
    protected function slowMovingSince(Builder $query, CarbonInterface $since): void
    {
        $this->slowSelling($query, $since, now(), 0, 0);
    }

    /**
     * Available products with stock that arrived before $from and sold only
     * $fewest to $most pieces from $from to $to (the Products list's
     * Slow-moving: 1 week, 1 month, 1 year or From – To, and how slow).
     *
     * @param  Builder<self>  $query
     */
    #[Scope]
    protected function slowSelling(Builder $query, CarbonInterface $from, CarbonInterface $to, int $fewest, int $most): void
    {
        $query->where('status', ProductStatus::Available)
            ->whereHas('variants', fn (Builder $variants) => $variants->where('stock_on_hand', '>', 0))
            ->whereHas('variants.stockMovements', fn (Builder $movements) => $movements->where('created_at', '<=', $from))
            ->where(self::piecesSoldBetween($from, $to), '>=', $fewest)
            ->where(self::piecesSoldBetween($from, $to), '<=', $most);
    }

    /**
     * Pieces of the product sold from $from to $to, as a subquery on
     * products: its orders that were not cancelled.
     *
     * @return Closure(QueryBuilder): QueryBuilder
     */
    public static function piecesSoldBetween(CarbonInterface $from, CarbonInterface $to): Closure
    {
        return fn (QueryBuilder $sold) => $sold->from('stock_movements')
            ->join('product_variants', 'product_variants.id', '=', 'stock_movements.product_variant_id')
            ->join('order_items', 'order_items.id', '=', 'stock_movements.order_item_id')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->whereColumn('product_variants.product_id', 'products.id')
            ->where('stock_movements.type', StockMovementType::Sale->value)
            ->where('orders.status', '!=', OrderStatus::Cancelled->value)
            ->whereBetween('stock_movements.created_at', [$from, $to])
            ->selectRaw('coalesce(sum(0 - stock_movements.quantity), 0)');
    }
}
