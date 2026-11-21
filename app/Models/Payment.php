<?php

namespace App\Models;

use App\Enums\PaymentMethod;
use Carbon\CarbonInterface;
use Database\Factories\PaymentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A payment the cashier recorded, and its Payment Receipt (RCT-2026-000001):
 * for an order or a preorder slip, by cash (amount received and change) or
 * GCash (13-digit reference). A payment undone by mistake, the same day and
 * before release, stays on record as VOID with the reason. Cashier data
 * only (and read-only for the School Admin); the Specialist never sees it.
 *
 * @property int $id
 * @property string|null $receipt_number
 * @property int|null $order_id
 * @property int|null $preorder_slip_id
 * @property int $user_id the buyer
 * @property int $amount_centavos
 * @property PaymentMethod $method
 * @property int|null $amount_received_centavos
 * @property int|null $change_centavos
 * @property string|null $gcash_reference
 * @property int|null $received_by
 * @property Carbon $paid_at
 * @property Carbon|null $voided_at
 * @property int|null $voided_by
 * @property string|null $void_reason
 * @property array{number: string|null, buyer_name: string, buyer_id: string|null, section: string|null, is_staff: bool, lines: list<array{quantity: int, item: string, unit_price_centavos: int, amount_centavos: int}>} $snapshot the receipt as issued
 * @property int $prints
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Order|null $order
 * @property-read PreorderSlip|null $preorderSlip
 * @property-read User $buyer
 * @property-read User|null $cashier
 * @property-read User|null $voider
 */
#[Fillable(['order_id', 'preorder_slip_id', 'user_id', 'amount_centavos', 'method', 'amount_received_centavos', 'change_centavos', 'gcash_reference', 'received_by', 'paid_at', 'snapshot'])]
class Payment extends Model
{
    /** @use HasFactory<PaymentFactory> */
    use HasFactory;

    /** The most a cashier can record as cash received for one payment, in centavos (₱100,000). */
    public const int MAX_RECEIVED_CENTAVOS = 10_000_000;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'method' => PaymentMethod::class,
            'paid_at' => 'datetime',
            'voided_at' => 'datetime',
            'amount_centavos' => 'integer',
            'amount_received_centavos' => 'integer',
            'change_centavos' => 'integer',
            'prints' => 'integer',
            'snapshot' => 'array',
        ];
    }

    /**
     * The receipt number from the id once saved: RCT-2026-000001. Never reused.
     */
    protected static function booted(): void
    {
        static::created(function (Payment $payment): void {
            $payment->forceFill(['receipt_number' => self::numberFor($payment->id, $payment->paid_at)])->saveQuietly();
        });
    }

    public static function numberFor(int $id, CarbonInterface $paidAt): string
    {
        return 'RCT-'.$paidAt->format('Y').'-'.str_pad((string) $id, 6, '0', STR_PAD_LEFT);
    }

    /**
     * The reason as a sentence ("Scanned the wrong slip."), for the record and the notices.
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
     * Mark it VOID with the reason: it stays on record but no longer counts.
     */
    public function void(User $by, string $reason): void
    {
        $this->forceFill(['voided_at' => now(), 'voided_by' => $by->id, 'void_reason' => $reason])->save();
    }

    public function isVoid(): bool
    {
        return $this->voided_at !== null;
    }

    /**
     * Payments that stand (not voided).
     *
     * @param  Builder<Payment>  $query
     */
    public function scopeValid(Builder $query): void
    {
        $query->whereNull('voided_at');
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
    public function buyer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function cashier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function voider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'voided_by');
    }
}
