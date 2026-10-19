<?php

namespace App\Models;

use App\Enums\PreorderStatus;
use Database\Factories\PreorderFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A student's reservation of a Preorder product, or of a sold-out size of a
 * product for sale (waiting for a restock): which size or color and how
 * many. It tells the Specialist how many to order in the eStore; there is
 * no payment. A student has at most one active preorder per variant;
 * preordering it again changes the quantity.
 *
 * @property int $id
 * @property int $user_id
 * @property int $product_id
 * @property int $product_variant_id
 * @property int $quantity
 * @property int $early_bird_pieces how many of its pieces get the early-bird price
 * @property PreorderStatus $status
 * @property Carbon|null $cancelled_at
 * @property Carbon|null $arrived_at when the student was told it arrived
 * @property Carbon|null $not_restocked_at when the student was told it will not be restocked
 * @property string|null $not_restocked_reason the Specialist's reason, if she gave one
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['user_id', 'product_id', 'product_variant_id', 'quantity', 'early_bird_pieces', 'status', 'cancelled_at', 'arrived_at', 'not_restocked_at', 'not_restocked_reason'])]
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
            'arrived_at' => 'datetime',
            'not_restocked_at' => 'datetime',
        ];
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
}
