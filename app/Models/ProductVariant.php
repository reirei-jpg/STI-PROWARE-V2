<?php

namespace App\Models;

use Database\Factories\ProductVariantFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * One combination of a product's options, e.g. Color: Blue with
 * Capacity: 22 oz. A product without options has one variant with an
 * empty combination. The price, when set, replaces the product's price.
 *
 * @property int $id
 * @property int $product_id
 * @property string $combination
 * @property list<array{option: string, choice: string}> $choices
 * @property string|null $estore_item_code
 * @property int|null $price_centavos
 * @property int $position
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['combination', 'choices', 'estore_item_code', 'price_centavos', 'position'])]
class ProductVariant extends Model
{
    /** @use HasFactory<ProductVariantFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'choices' => 'array',
            'price_centavos' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
