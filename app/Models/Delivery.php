<?php

namespace App\Models;

use Database\Factories\DeliveryFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * A delivery that arrived from Head Office, recorded by the Specialist. It
 * can cover items from several orders.
 *
 * @property int $id
 * @property Carbon $received_on
 * @property string|null $sales_invoice_number
 * @property string|null $delivery_receipt_number
 * @property string|null $note
 * @property int $recorded_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['received_on', 'sales_invoice_number', 'delivery_receipt_number', 'note', 'recorded_by'])]
class Delivery extends Model
{
    /** @use HasFactory<DeliveryFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'received_on' => 'date',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    /**
     * @return HasMany<DeliveryItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(DeliveryItem::class);
    }
}
