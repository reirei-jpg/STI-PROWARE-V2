<?php

namespace App\Models;

use Database\Factories\DeliveryItemFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * How many of one ordered item arrived in a delivery.
 *
 * @property int $id
 * @property int $delivery_id
 * @property int $purchase_order_item_id
 * @property int $quantity_received
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['purchase_order_item_id', 'quantity_received'])]
class DeliveryItem extends Model
{
    /** @use HasFactory<DeliveryItemFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'quantity_received' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<Delivery, $this>
     */
    public function delivery(): BelongsTo
    {
        return $this->belongsTo(Delivery::class);
    }

    /**
     * @return BelongsTo<PurchaseOrderItem, $this>
     */
    public function purchaseOrderItem(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrderItem::class);
    }

    /**
     * The stock movements that added this item to stock: one, or one per
     * variant when the variants share its eStore Item Code and the delivery
     * was split. There are none while it is not linked to a product yet (or
     * not split yet).
     *
     * @return HasMany<StockMovement, $this>
     */
    public function stockMovements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }
}
