<?php

namespace App\Models;

use App\Enums\ProductStatus;
use App\Enums\StockMovementType;
use Database\Factories\ProductFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
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
 * @property bool $sold_by_piece
 * @property int|null $price_centavos
 * @property int|null $sale_price_centavos
 * @property ProductStatus $status
 * @property int $low_stock_alert_at pieces at which the Specialist is warned, per variant
 * @property Carbon|null $sale_started_at
 * @property Carbon|null $sale_ends_at
 * @property Carbon|null $sale_ending_notified_at when the "sale ending tomorrow" notice was sent
 * @property Carbon|null $preorders_close_on last day students can preorder a Preorder product
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['name', 'sold_by_piece', 'price_centavos', 'sale_price_centavos', 'status', 'low_stock_alert_at', 'preorders_close_on'])]
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
            'sale_started_at' => 'datetime',
            'sale_ends_at' => 'datetime',
            'sale_ending_notified_at' => 'datetime',
            'preorders_close_on' => 'date',
        ];
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
     * at or below the product's low-stock number.
     *
     * @param  Builder<self>  $query
     */
    #[Scope]
    protected function lowOnStock(Builder $query): void
    {
        $query->whereIn('status', [ProductStatus::Available, ProductStatus::OnSale])
            ->whereHas('variants', fn (Builder $variants) => $variants->whereColumn('product_variants.stock_on_hand', '<=', 'products.low_stock_alert_at'));
    }

    /**
     * Available products with stock that first arrived at least $days ago
     * and sold nothing in the last $days: candidates for Put on Sale. A sale
     * is any stock taken out that is not a correction.
     *
     * @param  Builder<self>  $query
     */
    #[Scope]
    protected function slowMoving(Builder $query, int $days): void
    {
        $since = now()->subDays($days);

        $query->where('status', ProductStatus::Available)
            ->whereHas('variants', fn (Builder $variants) => $variants->where('stock_on_hand', '>', 0))
            ->whereHas('variants.stockMovements', fn (Builder $movements) => $movements->where('created_at', '<=', $since))
            ->whereDoesntHave('variants.stockMovements', fn (Builder $movements) => $movements
                ->where('created_at', '>', $since)
                ->where('quantity', '<', 0)
                ->where('type', '!=', StockMovementType::Correction));
    }
}
