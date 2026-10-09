<?php

namespace App\Models;

use App\Enums\ProductStatus;
use Database\Factories\ProductVariantFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * One combination of a product's options, e.g. Color: Blue with
 * Capacity: 22 oz. A product without options has one variant with an
 * empty combination. The price, when set, replaces the product's price per
 * piece.
 *
 * Its eStore Item Code links it to the items on uploaded purchase orders;
 * Head Office sends that item by the piece, or by the pack in estore_pack_id.
 * Stock on hand is the pieces on the shelf, counted in pieces; it only
 * changes through a stock movement, so every change is in the stock
 * history. Held pieces are on the shelf but kept for students' open orders
 * until the Specialist releases them; students can only buy the rest
 * (free to sell).
 *
 * @property int $id
 * @property int $product_id
 * @property string $combination
 * @property list<array{option: string, choice: string}> $choices
 * @property string|null $estore_item_code
 * @property int|null $estore_pack_id
 * @property int|null $price_centavos
 * @property int|null $sale_price_centavos its own sale price while On Sale; empty: the product's sale price, if any
 * @property int $stock_on_hand pieces on the shelf
 * @property int $held_pieces pieces on the shelf kept for open orders
 * @property Carbon|null $low_stock_notified_at when the low-stock warning was sent; cleared when stock rises above the number
 * @property int $position
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['combination', 'choices', 'estore_item_code', 'estore_pack_id', 'price_centavos', 'position'])]
class ProductVariant extends Model
{
    /** @use HasFactory<ProductVariantFactory> */
    use HasFactory;

    /** "Free to sell" (on the shelf, less held) for queries. */
    public const FREE_TO_SELL_SQL = '(product_variants.stock_on_hand - product_variants.held_pieces)';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'choices' => 'array',
            'price_centavos' => 'integer',
            'sale_price_centavos' => 'integer',
            'stock_on_hand' => 'integer',
            'held_pieces' => 'integer',
            'low_stock_notified_at' => 'datetime',
        ];
    }

    /**
     * Pieces students can still buy: on the shelf, less what is held for
     * open orders.
     */
    public function freeToSell(): int
    {
        return max(0, $this->stock_on_hand - $this->held_pieces);
    }

    /**
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * The pack Head Office sends this variant's eStore item in; none means
     * by the piece.
     *
     * @return BelongsTo<ProductPack, $this>
     */
    public function estorePack(): BelongsTo
    {
        return $this->belongsTo(ProductPack::class, 'estore_pack_id');
    }

    /**
     * @return HasMany<StockMovement, $this>
     */
    public function stockMovements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }

    /**
     * The normal price of one piece: its own price, or the product's; null
     * when the product is not sold by the piece.
     */
    public function normalPiecePrice(): ?int
    {
        return $this->product->sold_by_piece ? ($this->price_centavos ?? $this->product->price_centavos) : null;
    }

    /**
     * Its sale price per piece while the product is On Sale: its own, or the
     * product's for every variant; null when it is not on sale.
     */
    public function salePiecePrice(): ?int
    {
        $product = $this->product;

        if ($product->status !== ProductStatus::OnSale || ! $product->sold_by_piece) {
            return null;
        }

        return $this->sale_price_centavos ?? $product->sale_price_centavos;
    }

    /**
     * "Blue / 22 oz", like the Variants table of the product form; "Default"
     * for a product without options.
     */
    public function label(): string
    {
        return $this->choices === []
            ? 'Default'
            : implode(' / ', array_map(fn (array $choice): string => $choice['choice'], $this->choices));
    }

    /**
     * "TM Polo (S/M)", or just the product name for a product without
     * options.
     */
    public function displayName(): string
    {
        return $this->choices === []
            ? $this->product->name
            : "{$this->product->name} ({$this->label()})";
    }

    /**
     * Where deliveries of this variant's eStore item go in stock, and how
     * Head Office sends it: by the Piece (1 piece each) or by a pack.
     *
     * @return array{product_name: string, variant_label: string, has_options: bool, unit_name: string, pieces_per_unit: int}
     */
    public function stockTarget(): array
    {
        return [
            'product_name' => $this->product->name,
            'variant_label' => $this->label(),
            'has_options' => $this->choices !== [],
            'unit_name' => $this->estorePack->name ?? 'Piece',
            'pieces_per_unit' => $this->estorePack->pieces ?? 1,
        ];
    }
}
