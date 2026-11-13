<?php

namespace App\Models;

use App\Enums\PreorderStatus;
use App\Services\Shop\ShopPrice;
use Database\Factories\PreorderSlipFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * The slip of a batch of preorders (the sizes placed with one press of
 * Preorder), numbered PR-0001: the buyer pays its amount at the cashier and
 * the Specialist marks it Paid by scanning its QR. Once paid it is the
 * buyer's proof of payment: the preorder can no longer be changed or
 * cancelled, and there is no refund.
 *
 * @property int $id
 * @property string $batch
 * @property int $user_id
 * @property int $product_id
 * @property string|null $number
 * @property string $code the random code in the slip's QR
 * @property Carbon|null $paid_at
 * @property int|null $paid_by
 * @property int|null $paid_centavos what was paid, kept as it was on that day
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User $student
 * @property-read Product $product
 * @property-read User|null $payer
 */
#[Fillable(['batch', 'user_id', 'product_id'])]
class PreorderSlip extends Model
{
    /** @use HasFactory<PreorderSlipFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'paid_at' => 'datetime',
            'paid_centavos' => 'integer',
        ];
    }

    /**
     * A random QR code, and the number PR-0001 from the id once saved.
     */
    protected static function booted(): void
    {
        static::creating(function (PreorderSlip $slip): void {
            $slip->code ??= Str::random(32);
        });

        static::created(function (PreorderSlip $slip): void {
            $slip->forceFill(['number' => self::numberFor($slip->id)])->saveQuietly();
        });
    }

    /**
     * "PR-0007" from the slip's id.
     */
    public static function numberFor(int $id): string
    {
        return 'PR-'.str_pad((string) $id, 4, '0', STR_PAD_LEFT);
    }

    /**
     * The slip of a batch of preorders, made when it is first needed.
     */
    public static function forBatch(Preorder $preorder): self
    {
        return self::query()->firstOrCreate(
            ['batch' => $preorder->batch],
            ['user_id' => $preorder->user_id, 'product_id' => $preorder->product_id],
        );
    }

    public function isPaid(): bool
    {
        return $this->paid_at !== null;
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
     * @return BelongsTo<User, $this>
     */
    public function payer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'paid_by');
    }

    /**
     * Every preorder of the batch, in the order they were placed.
     *
     * @return HasMany<Preorder, $this>
     */
    public function preorders(): HasMany
    {
        return $this->hasMany(Preorder::class, 'batch', 'batch')->orderBy('id');
    }

    /**
     * The preorders the slip is for: while unpaid, those still waiting (one
     * already ordered and paid as an order is not paid again); once paid,
     * the ones paid for, also after they arrive.
     *
     * @return HasMany<Preorder, $this>
     */
    public function counted(): HasMany
    {
        return $this->isPaid()
            ? $this->preorders()->whereNotIn('status', [PreorderStatus::Cancelled, PreorderStatus::NotRestocked, PreorderStatus::HoldEnded])
            : $this->preorders()->where('status', PreorderStatus::Active);
    }

    /**
     * What one preorder costs: its early-bird pieces at the early-bird
     * price, the rest at the price on the day it was preordered (today's
     * price for preorders from before that was kept).
     */
    public static function amountOf(Preorder $preorder): int
    {
        $product = $preorder->product;
        $price = $preorder->price_centavos ?? (int) ShopPrice::perUnit($preorder->variant->setRelation('product', $product), null);
        $earlyBird = $product->early_bird_price_centavos === null ? 0 : min($preorder->early_bird_pieces, $preorder->quantity);

        return $earlyBird * (int) $product->early_bird_price_centavos + ($preorder->quantity - $earlyBird) * $price;
    }

    /**
     * What the buyer pays: what was paid once paid, else the batch's
     * preorders added up.
     */
    public function amountDue(): int
    {
        if ($this->paid_centavos !== null) {
            return $this->paid_centavos;
        }

        return (int) $this->counted()->with(['product', 'variant'])->get()->sum(fn (Preorder $preorder): int => self::amountOf($preorder));
    }
}
