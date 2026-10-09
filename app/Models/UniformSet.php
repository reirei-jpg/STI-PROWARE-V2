<?php

namespace App\Models;

use App\Enums\UniformTop;
use Database\Factories\UniformSetFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * One course's free uniform set, e.g. "BSIT": a top (the blouse for female
 * students, the polo for male students) and the pants, each a product with
 * its own eStore Item Code and sizes. Set up once by the Specialist.
 *
 * @property int $id
 * @property string $name
 * @property int|null $blouse_product_id
 * @property int|null $polo_product_id
 * @property int|null $pants_product_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Product|null $blouseProduct
 * @property-read Product|null $poloProduct
 * @property-read Product|null $pantsProduct
 */
#[Fillable(['name', 'blouse_product_id', 'polo_product_id', 'pants_product_id'])]
class UniformSet extends Model
{
    /** @use HasFactory<UniformSetFactory> */
    use HasFactory;

    /**
     * @return BelongsTo<Product, $this>
     */
    public function blouseProduct(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'blouse_product_id');
    }

    /**
     * @return BelongsTo<Product, $this>
     */
    public function poloProduct(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'polo_product_id');
    }

    /**
     * @return BelongsTo<Product, $this>
     */
    public function pantsProduct(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'pants_product_id');
    }

    /**
     * @return HasMany<FreeUniformStudent, $this>
     */
    public function students(): HasMany
    {
        return $this->hasMany(FreeUniformStudent::class);
    }

    /** The product of the top, or null when the set has no such top. */
    public function topProductId(UniformTop $top): ?int
    {
        return $top === UniformTop::Blouse ? $this->blouse_product_id : $this->polo_product_id;
    }
}
