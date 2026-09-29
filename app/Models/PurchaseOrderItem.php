<?php

namespace App\Models;

use Database\Factories\PurchaseOrderItemFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * One ordered item. The unit price is the Head Office cost, not the price
 * students pay. quantity_delivered grows as partial deliveries are recorded.
 *
 * @property int $id
 * @property int $purchase_order_id
 * @property int $row_number
 * @property string $item_code
 * @property string $description
 * @property int|null $stock_on_hand
 * @property int $quantity_ordered
 * @property int $quantity_delivered
 * @property int $unit_price_centavos
 * @property int $amount_centavos
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['row_number', 'item_code', 'description', 'stock_on_hand', 'quantity_ordered', 'quantity_delivered', 'unit_price_centavos', 'amount_centavos'])]
class PurchaseOrderItem extends Model
{
    /** @use HasFactory<PurchaseOrderItemFactory> */
    use HasFactory;

    /**
     * @return BelongsTo<PurchaseOrder, $this>
     */
    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class);
    }
}
