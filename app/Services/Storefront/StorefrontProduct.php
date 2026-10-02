<?php

namespace App\Services\Storefront;

use App\Enums\ProductStatus;
use App\Models\Product;
use App\Models\ProductOption;
use App\Models\ProductPack;
use App\Models\ProductPhoto;
use App\Models\ProductVariant;

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
     * @return array{id: int, name: string, status: string, photo_url: string|null, price: array{piece_centavos: int|null, piece_from: bool, sale_centavos: int|null, packs: list<array{name: string, pieces: int, price_centavos: int}>}, sold_out: bool, almost_sold_out: bool, pieces_left: int|null}
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
        ];
    }

    /**
     * The tile plus everything the view pop-up shows.
     *
     * @return array<string, mixed>
     */
    public static function details(Product $product): array
    {
        $isPreorder = $product->status === ProductStatus::Preorder;

        return [
            ...self::tile($product),
            'photos' => $product->photos->map(fn (ProductPhoto $photo): array => [
                'url' => $photo->url(),
                'label' => $photo->label,
            ])->all(),
            'options' => $product->options->map(fn (ProductOption $option): array => [
                'name' => $option->name,
                'choices' => $option->choices,
            ])->all(),
            'variants' => $product->variants->map(function (ProductVariant $variant) use ($product, $isPreorder): array {
                $stock = $variant->stock_on_hand;

                return [
                    'label' => $variant->label(),
                    'price_centavos' => $product->sold_by_piece ? ($variant->price_centavos ?? $product->price_centavos) : null,
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
     * The price per piece (the lowest, with "From" when sizes differ), the
     * sale price when On Sale, and each pack students can buy.
     *
     * @return array{piece_centavos: int|null, piece_from: bool, sale_centavos: int|null, packs: list<array{name: string, pieces: int, price_centavos: int}>}
     */
    private static function price(Product $product): array
    {
        $piecePrices = $product->sold_by_piece
            ? $product->variants
                ->map(fn (ProductVariant $variant): ?int => $variant->price_centavos ?? $product->price_centavos)
                ->filter(fn (?int $price): bool => $price !== null)
                ->unique()
            : collect();

        return [
            'piece_centavos' => $piecePrices->isEmpty() ? ($product->sold_by_piece ? $product->price_centavos : null) : (int) $piecePrices->min(),
            'piece_from' => $piecePrices->count() > 1,
            'sale_centavos' => $product->status === ProductStatus::OnSale ? $product->sale_price_centavos : null,
            'packs' => array_values($product->packs
                ->where('sold_to_students', true)
                ->map(fn (ProductPack $pack): array => [
                    'name' => $pack->name,
                    'pieces' => $pack->pieces,
                    'price_centavos' => (int) $pack->price_centavos,
                ])
                ->all()),
        ];
    }
}
