<?php

namespace App\Models;

use App\Enums\ProductStatus;
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
 * @property int $id
 * @property string $name
 * @property bool $sold_by_piece
 * @property int|null $price_centavos
 * @property int|null $sale_price_centavos
 * @property ProductStatus $status
 * @property int $low_stock_alert_at pieces at which the Specialist is warned, per variant
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['name', 'sold_by_piece', 'price_centavos', 'sale_price_centavos', 'status', 'low_stock_alert_at'])]
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
        ];
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
}
