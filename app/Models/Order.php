<?php

namespace App\Models;

use App\Enums\OrderStatus;
use Database\Factories\OrderFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * A student's order, numbered PW-0001, PW-0002… Its items are HELD when it
 * is placed (still on the shelf, but no one else can buy them) until the
 * Specialist scans its issuance slip and releases it; only then do they
 * leave the shelf. Not released by pick_up_by (OrderRules::holdDays), it
 * expires and its items are free to sell again.
 *
 * @property int $id
 * @property string|null $number
 * @property string|null $slip_code the random code in the issuance slip's QR
 * @property int $user_id
 * @property string|null $student_section the student's course/section when ordered, for the slip
 * @property OrderStatus $status
 * @property int $total_centavos
 * @property Carbon $pick_up_by
 * @property Carbon|null $ready_at
 * @property Carbon|null $picked_up_at when it was released
 * @property Carbon|null $cancelled_at
 * @property Carbon|null $expired_at when it was cancelled for not being released in time
 * @property Carbon|null $expiry_reminded_at when the student was reminded of the last day
 * @property string|null $cancel_reason
 * @property int|null $handled_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['user_id', 'student_section', 'status', 'total_centavos', 'pick_up_by'])]
class Order extends Model
{
    /** @use HasFactory<OrderFactory> */
    use HasFactory;

    /**
     * Every order gets its issuance slip's QR code: long and random, so a
     * slip cannot be guessed or made up from an order number.
     */
    protected static function booted(): void
    {
        static::creating(function (Order $order): void {
            $order->slip_code ??= Str::random(32);
        });
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => OrderStatus::class,
            'total_centavos' => 'integer',
            'pick_up_by' => 'datetime',
            'ready_at' => 'datetime',
            'picked_up_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'expired_at' => 'datetime',
            'expiry_reminded_at' => 'datetime',
        ];
    }

    /**
     * "PW-0042" from the order's id.
     */
    public static function numberFor(int $id): string
    {
        return 'PW-'.str_pad((string) $id, 4, '0', STR_PAD_LEFT);
    }

    /**
     * Orders not released or cancelled yet: their items are held.
     *
     * @param  Builder<self>  $query
     */
    #[Scope]
    protected function open(Builder $query): void
    {
        $query->whereIn('status', [OrderStatus::Placed, OrderStatus::Ready]);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function handler(): BelongsTo
    {
        return $this->belongsTo(User::class, 'handled_by');
    }

    /**
     * @return HasMany<OrderItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }
}
