<?php

namespace App\Services\Shop;

use App\Enums\ProductStatus;
use App\Models\CartItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Models\WishlistItem;
use App\Services\Stock\Units;
use App\Services\Storefront\StorefrontFeed;
use App\Services\Storefront\StorefrontProduct;
use Illuminate\Validation\ValidationException;

/**
 * A buyer's wishlist (panel revision, 20 Nov 2026), the same on the website
 * and the phone: items to buy later, with the size or color chosen (or
 * none). It holds no stock and has no quantity: Add to Cart from it opens
 * the item's picker. Each item says how it is doing now (its price today,
 * how many are left, sold out, coming soon), so the buyer knows when to buy.
 *
 * @phpstan-type WishlistRow array{id: int, product_id: int, product_variant_id: int|null, product_name: string, variant_label: string|null, photo_url: string|null, price: array<string, mixed>, on_sale: bool, can_buy: bool, can_preorder: bool, status_text: string, status_tone: string, added_on: string|null, product: array<string, mixed>}
 */
final class Wishlist
{
    /** The most items one wishlist can hold. */
    public const MAX_ITEMS = 100;

    /**
     * Add an item (with its size or color, if one was chosen). Choosing a
     * size replaces the same item saved without one.
     *
     * @throws ValidationException when the wishlist is full
     */
    public function add(User $buyer, Product $product, ?ProductVariant $variant): string
    {
        $item = new WishlistItem(['product_id' => $product->id, 'product_variant_id' => $variant?->id]);
        $item->setRelation('product', $product)->setRelation('variant', $variant);
        $name = $item->displayName();

        $exists = $buyer->wishlistItems()
            ->where('product_id', $product->id)
            ->where('product_variant_id', $variant?->id)
            ->exists();

        if ($exists) {
            return "{$name} is already in your wishlist.";
        }

        if ($variant !== null) {
            $buyer->wishlistItems()->where('product_id', $product->id)->whereNull('product_variant_id')->delete();
        }

        if ($buyer->wishlistItems()->count() >= self::MAX_ITEMS) {
            throw ValidationException::withMessages(['wishlist' => 'Your wishlist can have up to '.self::MAX_ITEMS.' items. Remove some first.']);
        }

        $buyer->wishlistItems()->create(['product_id' => $product->id, 'product_variant_id' => $variant?->id]);

        return "{$name} has been added to your wishlist.";
    }

    public function remove(WishlistItem $item): string
    {
        $item->loadMissing(['product', 'variant']);
        $name = $item->displayName();
        $item->delete();

        return "{$name} has been removed from your wishlist.";
    }

    /**
     * A cart line the buyer wants later: it goes to the wishlist (its size
     * or color) and leaves the cart. A uniform set cannot.
     *
     * @throws ValidationException for a uniform set, or a full wishlist
     */
    public function moveFromCart(CartItem $line): string
    {
        if ($line->set_key !== null) {
            throw ValidationException::withMessages(['wishlist' => 'A uniform set cannot be moved to the wishlist. Remove it instead.']);
        }

        $variant = $line->variant;
        $product = $variant->product;
        $this->add($line->student, $product, $variant);
        $line->delete();

        return "{$variant->displayName()} has been moved to your wishlist.";
    }

    /**
     * The buyer's wishlist, newest first.
     *
     * @return list<WishlistRow>
     */
    public static function view(User $buyer): array
    {
        $items = $buyer->wishlistItems()
            ->with(['product' => fn ($products) => $products->with(StorefrontFeed::RELATIONS), 'variant'])
            ->latest('id')
            ->get();

        return array_values($items->map(fn (WishlistItem $item): array => self::row($item))->all());
    }

    /**
     * @return WishlistRow
     */
    private static function row(WishlistItem $item): array
    {
        $product = $item->product;
        $variant = $item->variant?->setRelation('product', $product);
        $inStore = $product->status !== ProductStatus::Draft && ($variant === null || ! $variant->isDraft());
        $tile = StorefrontProduct::tile($product);
        $comingSoon = $product->status === ProductStatus::Preorder;
        $canBuy = $inStore && ShopPrice::canBuy($product);
        $stock = $variant === null ? (int) $product->variants->sum(fn (ProductVariant $each): int => $each->freeToSell()) : $variant->freeToSell();
        $canPreorder = $inStore && ($variant === null ? $tile['accepts_preorders'] : $variant->canBePreordered());

        $price = $tile['price'];

        if ($variant !== null && $price['piece_centavos'] !== null) {
            $price = [...$price, 'piece_centavos' => $variant->normalPiecePrice(), 'piece_from' => false, 'sale_centavos' => $variant->salePiecePrice()];
        }

        [$text, $tone] = match (true) {
            ! $inStore => ['No longer in the store', 'slate'],
            $comingSoon => [$tile['accepts_preorders'] ? 'Coming soon · preorder it' : 'Coming soon', 'blue'],
            $stock === 0 => [$canPreorder ? 'Out of stock · preorder it' : 'Out of stock', 'red'],
            $stock <= $product->low_stock_alert_at => ['Only '.Units::count($stock, 'Piece').' left', 'amber'],
            default => [Units::count($stock, 'Piece').' left', 'green'],
        };

        return [
            'id' => $item->id,
            'product_id' => $product->id,
            'product_variant_id' => $variant?->id,
            'product_name' => $product->name,
            'variant_label' => $variant === null || $variant->choices === [] ? null : $variant->label(),
            'photo_url' => $tile['photo_url'],
            'price' => $price,
            'on_sale' => $inStore && ($price['sale_centavos'] ?? null) !== null,
            // Add to Cart (in stock) or Preorder opens the item's picker.
            'can_buy' => $canBuy && ! $comingSoon && $stock > 0,
            'can_preorder' => $canPreorder,
            'status_text' => $text,
            'status_tone' => $tone,
            'added_on' => $item->created_at?->toDateString(),
            // The store tile, so Add to Cart and Preorder open as in the store.
            'product' => $tile,
        ];
    }
}
