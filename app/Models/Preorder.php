<?php

namespace App\Models;

use App\Enums\PreorderStatus;
use Database\Factories\PreorderFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * A student's reservation of a Preorder product, or of a sold-out size of a
 * product for sale (waiting for a restock): which size or color and how
 * many. It tells the Specialist how many to order in the eStore. Its batch
 * is paid at the cashier with a preorder slip (PreorderSlip). A student has at most one active preorder per variant;
 * preordering it again changes the quantity.
 *
 * @property int $id
 * @property int $user_id
 * @property int $product_id
 * @property int $product_variant_id
 * @property int $quantity
 * @property int|null $price_centavos one piece's price on the day it was preordered (null before this was kept)
 * @property int $early_bird_pieces how many of its pieces get the early-bird price
 * @property PreorderStatus $status
 * @property Carbon|null $cancelled_at
 * @property Carbon|null $arrived_at when the student was told it arrived
 * @property Carbon|null $not_restocked_at when the student was told it will not be restocked
 * @property string|null $not_restocked_reason the Specialist's reason, if she gave one
 * @property Carbon|null $held_until while Held: the end of the student's 24 hours to order
 * @property Carbon|null $hold_ended_at when the hold ended without an order
 * @property int|null $order_id the order the held pieces went into
 * @property string $batch preorders placed with one press of Preorder share it (one card on My Preorders)
 * @property Carbon|null $edited_at when the buyer last changed its size, color or quantity
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['user_id', 'product_id', 'product_variant_id', 'quantity', 'price_centavos', 'early_bird_pieces', 'status', 'cancelled_at', 'arrived_at', 'not_restocked_at', 'not_restocked_reason', 'held_until', 'hold_ended_at', 'order_id', 'batch', 'edited_at'])]
class Preorder extends Model
{
    /** @use HasFactory<PreorderFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'early_bird_pieces' => 'integer',
            'status' => PreorderStatus::class,
            'cancelled_at' => 'datetime',
            'held_until' => 'datetime',
            'hold_ended_at' => 'datetime',
            'arrived_at' => 'datetime',
            'not_restocked_at' => 'datetime',
            'edited_at' => 'datetime',
        ];
    }

    /**
     * A preorder placed on its own is a batch of one.
     */
    protected static function booted(): void
    {
        static::creating(function (Preorder $preorder): void {
            $preorder->batch ??= (string) Str::uuid();
        });
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * @return BelongsTo<ProductVariant, $this>
     */
    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }

    /**
     * Preorders counted as $status on the Specialist's screens: Arrived
     * also counts the ones whose pieces arrived and were held, ordered or
     * not ordered in time.
     *
     * @param  Builder<self>  $query
     */
    #[Scope]
    protected function countedAs(Builder $query, PreorderStatus $status): void
    {
        $query->whereIn('status', $status === PreorderStatus::Arrived
            ? PreorderStatus::arrivedGroup()
            : [$status]);
    }

    /**
     * Preorders whose batch was paid at the cashier: the ones that count
     * when deciding how many to order.
     *
     * @param  Builder<self>  $query
     */
    #[Scope]
    protected function paid(Builder $query): void
    {
        $query->whereIn('batch', PreorderSlip::query()->whereNotNull('paid_at')->select('batch'));
    }

    /**
     * The slip of its batch, paid at the cashier.
     *
     * @return BelongsTo<PreorderSlip, $this>
     */
    public function slip(): BelongsTo
    {
        return $this->belongsTo(PreorderSlip::class, 'batch', 'batch');
    }

    /**
     * @return BelongsTo<Order, $this>
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
