<?php

namespace App\Models;

use App\Enums\UniformSetFor;
use App\Enums\UniformTop;
use Database\Factories\UniformSetFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * One course's uniform set, e.g. "BSIT": a top (the blouse for female
 * students, the polo for male students) and the pants, each a product with
 * its own eStore Item Code and sizes. Set up once by the Specialist. It is
 * given free to new students (Free Uniforms), and when sold as a set
 * students can buy it whole, at what its two pieces cost: for boys the polo
 * and pants, for girls the blouse and the ladies' pants or the skirt.
 *
 * @property int $id
 * @property string $name
 * @property int|null $blouse_product_id
 * @property int|null $polo_product_id
 * @property int|null $pants_product_id
 * @property int|null $ladies_pants_product_id
 * @property int|null $skirt_product_id
 * @property bool $sold_as_set students can buy it whole in the store
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Product|null $blouseProduct
 * @property-read Product|null $poloProduct
 * @property-read Product|null $pantsProduct
 * @property-read Product|null $ladiesPantsProduct
 * @property-read Product|null $skirtProduct
 */
#[Fillable(['name', 'blouse_product_id', 'polo_product_id', 'pants_product_id', 'ladies_pants_product_id', 'skirt_product_id', 'sold_as_set'])]
class UniformSet extends Model
{
    /** @use HasFactory<UniformSetFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'sold_as_set' => 'boolean',
        ];
    }

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
     * @return BelongsTo<Product, $this>
     */
    public function ladiesPantsProduct(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'ladies_pants_product_id');
    }

    /**
     * @return BelongsTo<Product, $this>
     */
    public function skirtProduct(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'skirt_product_id');
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

    /**
     * The top of a set bought for boys (the polo) or girls (the blouse).
     */
    public function topForSale(UniformSetFor $for): ?int
    {
        return $for === UniformSetFor::Boys ? $this->polo_product_id : $this->blouse_product_id;
    }

    /**
     * The bottoms students can choose: the pants for boys; the ladies' pants
     * and / or the skirt for girls.
     *
     * @return list<int> product ids
     */
    public function bottomsForSale(UniformSetFor $for): array
    {
        return array_values(array_filter(
            $for === UniformSetFor::Boys ? [$this->pants_product_id] : [$this->ladies_pants_product_id, $this->skirt_product_id],
            fn (?int $productId): bool => $productId !== null,
        ));
    }

    /**
     * Whether students can buy it as a set for boys or girls: it is sold as
     * a set, with a top and at least one bottom.
     */
    public function sellsFor(UniformSetFor $for): bool
    {
        return $this->sold_as_set
            && $this->topForSale($for) !== null
            && $this->bottomsForSale($for) !== [];
    }

    /** "BSIT Uniform Set" */
    public function displayName(): string
    {
        return "{$this->name} Uniform Set";
    }
}
