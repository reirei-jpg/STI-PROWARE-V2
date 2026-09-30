<?php

namespace App\Models;

use App\Enums\DeliveryStatus;
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
 * orders inside the eStore. Items arrive in one or more deliveries; the
 * running totals and delivery status are kept here so lists stay fast.
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
 * @property Carbon|null $expected_delivery_date
 * @property string|null $expected_delivery_note
 * @property Carbon|null $day_before_reminder_sent_at
 * @property Carbon|null $day_of_reminder_sent_at
 * @property int $quantity_ordered_total
 * @property int $quantity_received_total
 * @property DeliveryStatus $delivery_status
 * @property string|null $closed_reason
 * @property Carbon|null $closed_at
 * @property int|null $closed_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable([
    'order_number', 'school', 'ordered_by', 'uploaded_by', 'date_ordered', 'time_ordered', 'category',
    'total_amount_centavos', 'original_file_name', 'document_path',
    'expected_delivery_date', 'expected_delivery_note', 'day_before_reminder_sent_at', 'day_of_reminder_sent_at',
    'quantity_ordered_total', 'quantity_received_total', 'delivery_status', 'closed_reason', 'closed_at', 'closed_by',
])]
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
            'expected_delivery_date' => 'date',
            'day_before_reminder_sent_at' => 'datetime',
            'day_of_reminder_sent_at' => 'datetime',
            'quantity_ordered_total' => 'integer',
            'quantity_received_total' => 'integer',
            'delivery_status' => DeliveryStatus::class,
            'closed_at' => 'datetime',
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
     * @return BelongsTo<User, $this>
     */
    public function closer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by');
    }

    /**
     * @return HasMany<PurchaseOrderItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(PurchaseOrderItem::class)->orderBy('row_number');
    }

    public function quantityRemaining(): int
    {
        return max(0, $this->quantity_ordered_total - $this->quantity_received_total);
    }

    /**
     * Whole-number percentage received, e.g. 60.
     */
    public function percentReceived(): int
    {
        return $this->quantity_ordered_total === 0
            ? 0
            : (int) floor($this->quantity_received_total * 100 / $this->quantity_ordered_total);
    }

    /**
     * Recount the totals from the items and set the delivery status. An
     * order closed short keeps that status.
     */
    public function refreshDeliveryProgress(): void
    {
        $ordered = (int) $this->items()->sum('quantity_ordered');
        $received = (int) $this->items()->sum('quantity_delivered');

        $status = match (true) {
            $this->closed_at !== null => DeliveryStatus::CompletedShort,
            $received === 0 => DeliveryStatus::Awaiting,
            $received >= $ordered => DeliveryStatus::Completed,
            default => DeliveryStatus::PartiallyReceived,
        };

        $this->forceFill([
            'quantity_ordered_total' => $ordered,
            'quantity_received_total' => $received,
            'delivery_status' => $status,
        ]);

        if (! $status->isOpen()) {
            $this->clearExpectedDelivery();
        }

        $this->save();
    }

    /**
     * Forget the expected delivery date and the reminders sent for it.
     */
    public function clearExpectedDelivery(): void
    {
        $this->forceFill([
            'expected_delivery_date' => null,
            'expected_delivery_note' => null,
            'day_before_reminder_sent_at' => null,
            'day_of_reminder_sent_at' => null,
        ]);
    }
}
