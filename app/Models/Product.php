<?php

namespace App\Models;

use App\Enums\ProductStatus;
use Database\Factories\ProductFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * Merchandise the Specialist sells to students through the storefront.
 *
 * @property int $id
 * @property string $name
 * @property int $price_centavos
 * @property int|null $sale_price_centavos
 * @property ProductStatus $status
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['name', 'price_centavos', 'sale_price_centavos', 'status'])]
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
            'price_centavos' => 'integer',
            'sale_price_centavos' => 'integer',
            'status' => ProductStatus::class,
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
}
