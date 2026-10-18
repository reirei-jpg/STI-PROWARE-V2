<?php

namespace App\Models;

use App\Enums\UniformSetFor;
use Database\Factories\CartItemFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Something in a student's cart: a size or color, by the piece (no pack) or
 * by a pack, and how many, and whether it is ticked for the next Place
 * Order. Prices are not kept here; the current price is used until the
 * order is placed.
 *
 * A uniform set is two lines, its top and its bottom, with the same set key
 * (and the same quantity, tick and set); they are changed and removed
 * together.
 *
 * @property int $id
 * @property int $user_id
 * @property int $product_variant_id
 * @property int|null $product_pack_id
 * @property int|null $uniform_set_id the set this line is part of; null for a single item
 * @property string|null $set_key the same on the set's two lines
 * @property UniformSetFor|null $set_for
 * @property int $quantity
 * @property bool $selected ticked for the next Place Order
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read UniformSet|null $uniformSet
 */
#[Fillable(['user_id', 'product_variant_id', 'product_pack_id', 'uniform_set_id', 'set_key', 'set_for', 'quantity', 'selected'])]
class CartItem extends Model
{
    /** @use HasFactory<CartItemFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'selected' => 'boolean',
            'set_for' => UniformSetFor::class,
        ];
    }

    /**
     * @return BelongsTo<UniformSet, $this>
     */
    public function uniformSet(): BelongsTo
    {
        return $this->belongsTo(UniformSet::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * @return BelongsTo<ProductVariant, $this>
     */
    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }

    /**
     * The pack bought, or none for by the piece.
     *
     * @return BelongsTo<ProductPack, $this>
     */
    public function pack(): BelongsTo
    {
        return $this->belongsTo(ProductPack::class, 'product_pack_id');
    }

    /**
     * Pieces this takes from stock: the quantity, times the pieces in the
     * pack when bought by the pack.
     */
    public function pieces(): int
    {
        return $this->quantity * ($this->pack->pieces ?? 1);
    }
}
