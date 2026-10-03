<?php

namespace App\Services\Shop;

use App\Enums\ProductStatus;
use App\Models\Product;
use App\Models\ProductPack;
use App\Models\ProductVariant;
use App\Services\Stock\LowStockAlerts;

/**
 * What students pay right now: per piece (the variant's sale price while On
 * Sale, else its own price or the product's) and per pack (its sale price
 * while On Sale, if it has one). Only Available and On Sale products can be
 * bought.
 */
final class ShopPrice
{
    public static function canBuy(Product $product): bool
    {
        return LowStockAlerts::isSold($product);
    }

    /**
     * @return int|null centavos per piece; null when not sold by the piece
     */
    public static function perPiece(ProductVariant $variant): ?int
    {
        return $variant->salePiecePrice() ?? $variant->normalPiecePrice();
    }

    /**
     * @return int|null centavos per pack; null when students cannot buy the pack
     */
    public static function perPack(ProductPack $pack): ?int
    {
        if (! $pack->sold_to_students) {
            return null;
        }

        if ($pack->product->status === ProductStatus::OnSale && $pack->sale_price_centavos !== null) {
            return $pack->sale_price_centavos;
        }

        return $pack->price_centavos;
    }

    /**
     * The price of one unit: one piece, or one pack when $pack is given.
     */
    public static function perUnit(ProductVariant $variant, ?ProductPack $pack): ?int
    {
        return $pack === null ? self::perPiece($variant) : self::perPack($pack);
    }
}
