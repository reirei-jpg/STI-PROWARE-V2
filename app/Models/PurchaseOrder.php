<?php

namespace App\Models;

use Database\Factories\PurchaseOrderFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * An order the Specialist placed in the eStore and uploaded here, known by
 * the eStore's Order #. Orders saved before Order # was read have none.
 *
 * The supplier is always STI Head Office, and the School Admin approves
 * orders inside the eStore.
 *
 * @property int $id
 * @property string|null $order_number
 * @property string|null $school
 * @property string|null $ordered_by
 * @property int $uploaded_by
 * @property Carbon $date_ordered
 * @property string|null $time_ordered
 * @property string|null $category
 * @property int|null $total_amount_centavos
 * @property string $original_file_name
 * @property string $document_path
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['order_number', 'school', 'ordered_by', 'uploaded_by', 'date_ordered', 'time_ordered', 'category', 'total_amount_centavos', 'original_file_name', 'document_path'])]
class PurchaseOrder extends Model
{
    /** @use HasFactory<PurchaseOrderFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'date_ordered' => 'date',
            'total_amount_centavos' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    /**
     * @return HasMany<PurchaseOrderItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(PurchaseOrderItem::class)->orderBy('row_number');
    }
}
