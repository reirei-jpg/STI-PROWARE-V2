<?php

namespace App\Services\Storefront;

use App\Enums\ProductStatus;
use App\Models\Product;
use App\Models\ProductOption;
use App\Models\ProductPack;
use App\Models\ProductPhoto;
use App\Models\ProductVariant;
use App\Services\Shop\ShopPrice;

/**
 * How a product looks to students on the storefront: its tile (photo, name,
 * price, badges) and its view pop-up (all photos, options, which variants
 * are in stock). Exact stock numbers are only shown when few are left
 * ("Only 3 left"), using the product's low-stock number.
 *
 * Expects the product's main photo, packs and variants to be loaded; the
 * view also needs its photos and options.
 */
final class StorefrontProduct
{
    /**
     * @return array{id: int, name: string, status: string, photo_url: string|null, price: array{piece_centavos: int|null, piece_from: bool, sale_centavos: int|null, packs: list<array{name: string, pieces: int, price_centavos: int, sale_price_centavos: int|null}>}, sold_out: bool, almost_sold_out: bool, pieces_left: int|null, sale_ends_at: string|null, preorders_close_on: string|null, accepts_preorders: bool}
     */
    public static function tile(Product $product): array
    {
        $stock = (int) $product->variants->sum('stock_on_hand');
        $isPreorder = $product->status === ProductStatus::Preorder;
        $almostSoldOut = ! $isPreorder && $stock > 0 && $stock <= $product->low_stock_alert_at;

        return [
            'id' => $product->id,
            'name' => $product->name,
            'status' => $product->status->value,
            'photo_url' => $product->mainPhoto?->url(),
            'price' => self::price($product),
            'sold_out' => ! $isPreorder && $stock === 0,
            'almost_sold_out' => $almostSoldOut,
            'pieces_left' => $almostSoldOut ? $stock : null,
            'sale_ends_at' => $product->status === ProductStatus::OnSale ? $product->sale_ends_at?->toIso8601String() : null,
            'preorders_close_on' => $isPreorder ? $product->preorders_close_on?->toDateString() : null,
            'accepts_preorders' => $product->acceptsPreorders(),
        ];
    }

    /**
     * One product's view as students get it (website pop-up and phone app):
     * Draft products do not exist for students.
     *
     * @return array<string, mixed>
     */
    public static function forStudents(Product $product): array
    {
        abort_if($product->status === ProductStatus::Draft, 404);

        return self::details($product->load([...StorefrontFeed::RELATIONS, 'photos', 'options']));
    }

    /**
     * The tile plus everything the view pop-up and the Add to Cart picker
     * show: each size or color with today's price per piece and its stock
     * (to cap how many can be added), and the packs students can buy.
     *
     * @return array<string, mixed>
     */
    public static function details(Product $product): array
    {
        $isPreorder = $product->status === ProductStatus::Preorder;
        $canBuy = ShopPrice::canBuy($product);

        return [
            ...self::tile($product),
            'buy_packs' => $canBuy ? array_values($product->packs
                ->where('sold_to_students', true)
                ->map(fn (ProductPack $pack): array => [
                    'id' => $pack->id,
                    'name' => $pack->name,
                    'pieces' => $pack->pieces,
                    'price_centavos' => (int) ShopPrice::perPack($pack->setRelation('product', $product)),
                ])
                ->all()) : [],
            'photos' => $product->photos->map(fn (ProductPhoto $photo): array => [
                'url' => $photo->url(),
                'label' => $photo->label,
            ])->all(),
            'options' => $product->options->map(fn (ProductOption $option): array => [
                'name' => $option->name,
                'choices' => $option->choices,
            ])->all(),
            'variants' => $product->variants->map(function (ProductVariant $variant) use ($product, $isPreorder, $canBuy): array {
                $stock = $variant->stock_on_hand;
                $variant->setRelation('product', $product);

                return [
                    'id' => $variant->id,
                    'label' => $variant->label(),
                    'price_centavos' => $variant->normalPiecePrice(),
                    'sale_price_centavos' => $variant->salePiecePrice(),
                    'buy_price_centavos' => $canBuy ? ShopPrice::perPiece($variant) : null,
                    'stock_pieces' => $canBuy ? $stock : 0,
                    'availability' => match (true) {
                        $isPreorder => 'coming_soon',
                        $stock === 0 => 'sold_out',
                        $stock <= $product->low_stock_alert_at => 'almost_sold_out',
                        default => 'in_stock',
                    },
                    'pieces_left' => ! $isPreorder && $stock > 0 && $stock <= $product->low_stock_alert_at ? $stock : null,
                ];
            })->all(),
        ];
    }

    /**
     * The price per piece (the lowest, with "From" when sizes differ), and
     * while On Sale the lowest sale price with that variant's normal price
     * crossed out, and each pack students can buy.
     *
     * @return array{piece_centavos: int|null, piece_from: bool, sale_centavos: int|null, packs: list<array{name: string, pieces: int, price_centavos: int, sale_price_centavos: int|null}>}
     */
    private static function price(Product $product): array
    {
        $onSale = $product->status === ProductStatus::OnSale;

        $variants = $product->sold_by_piece
            ? $product->variants->each(fn (ProductVariant $variant) => $variant->setRelation('product', $product))
            : collect();
        $piecePrices = $variants
            ->map(fn (ProductVariant $variant): ?int => $variant->normalPiecePrice())
            ->filter(fn (?int $price): bool => $price !== null)
            ->unique();

        // The variant on sale at the lowest price, if any.
        $cheapestOnSale = $variants
            ->filter(fn (ProductVariant $variant): bool => $variant->salePiecePrice() !== null)
            ->sortBy(fn (ProductVariant $variant): array => [$variant->salePiecePrice(), $variant->normalPiecePrice()])
            ->first();
        $nowPrices = $variants->map(fn (ProductVariant $variant): ?int => $variant->salePiecePrice() ?? $variant->normalPiecePrice())->filter()->unique();

        if ($cheapestOnSale !== null) {
            return [
                'piece_centavos' => $cheapestOnSale->normalPiecePrice(),
                'piece_from' => $nowPrices->count() > 1,
                'sale_centavos' => $cheapestOnSale->salePiecePrice(),
                'packs' => self::packPrices($product, $onSale),
            ];
        }

        return [
            'piece_centavos' => $piecePrices->isEmpty() ? ($product->sold_by_piece ? $product->price_centavos : null) : (int) $piecePrices->min(),
            'piece_from' => $piecePrices->count() > 1,
            'sale_centavos' => null,
            'packs' => self::packPrices($product, $onSale),
        ];
    }

    /**
     * Each pack students can buy, with its sale price while On Sale.
     *
     * @return list<array{name: string, pieces: int, price_centavos: int, sale_price_centavos: int|null}>
     */
    private static function packPrices(Product $product, bool $onSale): array
    {
        return array_values($product->packs
            ->where('sold_to_students', true)
            ->map(fn (ProductPack $pack): array => [
                'name' => $pack->name,
                'pieces' => $pack->pieces,
                'price_centavos' => (int) $pack->price_centavos,
                'sale_price_centavos' => $onSale ? $pack->sale_price_centavos : null,
            ])
            ->all());
    }
}
