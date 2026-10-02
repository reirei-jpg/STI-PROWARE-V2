<?php

namespace App\Services\Stock;

use App\Enums\ProductStatus;
use App\Enums\UserRole;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Notifications\LowStockAlert;
use Illuminate\Support\Facades\Notification;

/**
 * Warns the Specialist when a variant of a product students can buy
 * (Available or On Sale) falls to the product's low-stock number. Each
 * variant is warned once; when its stock rises above the number again
 * (e.g. a delivery arrives) it can be warned again next time.
 */
final class LowStockAlerts
{
    /**
     * Run after a variant's stock changed.
     */
    public function check(ProductVariant $variant): void
    {
        $variant->loadMissing('product');
        $product = $variant->product;

        if ($variant->stock_on_hand > $product->low_stock_alert_at) {
            if ($variant->low_stock_notified_at !== null) {
                $variant->forceFill(['low_stock_notified_at' => null])->save();
            }

            return;
        }

        if ($variant->low_stock_notified_at !== null || ! self::isSold($product)) {
            return;
        }

        Notification::send(
            User::query()->where('role', UserRole::Specialist)->get(),
            new LowStockAlert($variant),
        );

        $variant->forceFill(['low_stock_notified_at' => now()])->save();
    }

    /**
     * After the Specialist changes the low-stock number: variants now above
     * it can be warned again later. No warning is sent here.
     */
    public function rearm(Product $product): void
    {
        $product->variants()
            ->whereNotNull('low_stock_notified_at')
            ->where('stock_on_hand', '>', $product->low_stock_alert_at)
            ->update(['low_stock_notified_at' => null]);
    }

    /**
     * Products students can buy now; Draft and Preorder products usually
     * have no stock yet, so they would always look low.
     */
    public static function isSold(Product $product): bool
    {
        return in_array($product->status, [ProductStatus::Available, ProductStatus::OnSale], true);
    }
}
