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

/**
 * A student's order, numbered PW-0001, PW-0002… The stock is taken when it
 * is placed and held until pickup; the student pays in cash at the PROWARE
 * office. Not picked up by pick_up_by (3 days), it cancels itself and the
 * stock goes back.
 *
 * @property int $id
 * @property string|null $number
 * @property int $user_id
 * @property OrderStatus $status
 * @property int $total_centavos
 * @property Carbon $pick_up_by
 * @property Carbon|null $ready_at
 * @property Carbon|null $picked_up_at
 * @property Carbon|null $cancelled_at
 * @property string|null $cancel_reason
 * @property int|null $handled_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['user_id', 'status', 'total_centavos', 'pick_up_by'])]
class Order extends Model
{
    /** @use HasFactory<OrderFactory> */
    use HasFactory;

    public const PICK_UP_DAYS = 3;

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
     * Orders not picked up or cancelled yet: their stock is held.
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
