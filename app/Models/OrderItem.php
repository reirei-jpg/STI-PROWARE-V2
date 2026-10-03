<?php

namespace App\Models;

use Database\Factories\OrderItemFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * One line of an order, kept as it was when ordered: the product and size
 * or color, by the piece or by a pack, how many, and the price then.
 *
 * @property int $id
 * @property int $order_id
 * @property int $product_id
 * @property int $product_variant_id
 * @property string $product_name
 * @property string|null $variant_label
 * @property string $unit_name "Piece" or the pack's name
 * @property int $pieces_per_unit
 * @property int $quantity
 * @property int $unit_price_centavos
 * @property int $line_total_centavos
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['product_id', 'product_variant_id', 'product_name', 'variant_label', 'unit_name', 'pieces_per_unit', 'quantity', 'unit_price_centavos', 'line_total_centavos'])]
class OrderItem extends Model
{
    /** @use HasFactory<OrderItemFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'pieces_per_unit' => 'integer',
            'quantity' => 'integer',
            'unit_price_centavos' => 'integer',
            'line_total_centavos' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<Order, $this>
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /**
     * @return BelongsTo<ProductVariant, $this>
     */
    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }

    /**
     * @return HasMany<StockMovement, $this>
     */
    public function stockMovements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }

    public function pieces(): int
    {
        return $this->quantity * $this->pieces_per_unit;
    }
}
