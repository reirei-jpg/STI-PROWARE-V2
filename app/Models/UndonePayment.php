<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Database\Factories\UndonePaymentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A payment the cashier recorded by mistake and undid the same day, before
 * the items were released (an order's or a preorder slip's), kept on record
 * with the reason. The order or slip is waiting for payment again.
 *
 * @property int $id
 * @property int|null $order_id
 * @property int|null $preorder_slip_id
 * @property int $amount_centavos
 * @property Carbon $paid_at
 * @property int|null $paid_by
 * @property int|null $undone_by
 * @property string $reason
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Order|null $order
 * @property-read PreorderSlip|null $preorderSlip
 * @property-read User|null $undoer
 */
#[Fillable(['order_id', 'preorder_slip_id', 'amount_centavos', 'paid_at', 'paid_by', 'undone_by', 'reason'])]
class UndonePayment extends Model
{
    /** @use HasFactory<UndonePaymentFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'paid_at' => 'datetime',
            'amount_centavos' => 'integer',
        ];
    }

    /**
     * The reason as a sentence ("Scanned the wrong slip."), for the notices.
     */
    public static function sentence(string $reason): string
    {
        $reason = trim(preg_replace('/\s+/', ' ', $reason) ?? $reason);

        return preg_match('/[.!?]$/', $reason) === 1 ? $reason : "{$reason}.";
    }

    /**
     * Why a payment recorded on another day cannot be undone, or null when it
     * was recorded today.
     */
    public static function notToday(string $what, ?CarbonInterface $paidAt): ?string
    {
        return $paidAt === null || $paidAt->isToday()
            ? null
            : "The payment for {$what} was recorded on {$paidAt->format('M j, Y')}. A payment can only be undone on the day it was recorded.";
    }

    /**
     * @return BelongsTo<Order, $this>
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /**
     * @return BelongsTo<PreorderSlip, $this>
     */
    public function preorderSlip(): BelongsTo
    {
        return $this->belongsTo(PreorderSlip::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function undoer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'undone_by');
    }
}
