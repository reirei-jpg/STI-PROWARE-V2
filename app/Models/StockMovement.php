<?php

namespace App\Models;

use App\Enums\StockMovementType;
use Database\Factories\StockMovementFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * One change to a variant's stock, in pieces, with the balance after it.
 * For a delivery it also keeps the eStore quantity and the pack it came in,
 * e.g. 2 × Pack (50 pieces) = +100. Together these are the stock history.
 *
 * @property int $id
 * @property int $product_variant_id
 * @property StockMovementType $type
 * @property int $quantity
 * @property int $balance_after
 * @property int|null $delivery_item_id
 * @property int|null $units_received
 * @property string|null $unit_name
 * @property int|null $pieces_per_unit
 * @property string|null $reason
 * @property string|null $note
 * @property int|null $recorded_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['type', 'quantity', 'balance_after', 'delivery_item_id', 'units_received', 'unit_name', 'pieces_per_unit', 'reason', 'note', 'recorded_by'])]
class StockMovement extends Model
{
    /** @use HasFactory<StockMovementFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => StockMovementType::class,
            'quantity' => 'integer',
            'balance_after' => 'integer',
            'units_received' => 'integer',
            'pieces_per_unit' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<ProductVariant, $this>
     */
    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }

    /**
     * @return BelongsTo<DeliveryItem, $this>
     */
    public function deliveryItem(): BelongsTo
    {
        return $this->belongsTo(DeliveryItem::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
