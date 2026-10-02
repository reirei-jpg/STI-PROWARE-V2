<?php

namespace App\Models;

use Database\Factories\ProductPackFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A pack of a product, e.g. "Pack" = 50 pieces. Head Office may send an
 * item by the pack, and students may buy a whole pack at its own price.
 * Stock is always counted in pieces.
 *
 * @property int $id
 * @property int $product_id
 * @property string $name
 * @property int $pieces
 * @property bool $sold_to_students
 * @property int|null $price_centavos
 * @property int $position
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['name', 'pieces', 'sold_to_students', 'price_centavos', 'position'])]
class ProductPack extends Model
{
    /** @use HasFactory<ProductPackFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'pieces' => 'integer',
            'sold_to_students' => 'boolean',
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

    /**
     * "Pack (50 pcs)".
     */
    public function label(): string
    {
        return "{$this->name} ({$this->pieces} pcs)";
    }
}
