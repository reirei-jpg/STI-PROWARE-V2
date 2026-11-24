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
 * Warns the Specialist when a variant of a product buyers can buy
 * (Available or On Sale) falls to its Reorder Point (ReorderPoints), counting
 * what is free to sell (pieces held for orders are as good as gone). Each
 * variant is warned once; it can be warned again only after more pieces
 * came in (a delivery or a recount) and its stock is above the Reorder Point
 * again, not when a cancelled or expired order frees its pieces for a moment.
 */
final class LowStockAlerts
{
    public function __construct(private ReorderPoints $reorderPoints) {}

    /**
     * Run after a variant's stock changed: its Reorder Point is worked out
     * again first (a sale changes it). $restocked is true when pieces came
     * in (a delivery, or a recount that found more): the variant can then be
     * warned again once it is above the Reorder Point. Without it, only a
     * shelf fuller than when it was warned counts, since the sold pieces
     * have left the shelf by then.
     */
    public function check(ProductVariant $variant, bool $restocked = false): void
    {
        $variant->loadMissing('product');
        $product = $variant->product;
        $this->reorderPoints->refreshVariant($variant);

        if ($variant->freeToSell() > $variant->reorder_point) {
            if ($variant->low_stock_notified_at !== null && ($restocked || $variant->stock_on_hand > (int) $variant->low_stock_notified_stock)) {
                $variant->forceFill(['low_stock_notified_at' => null, 'low_stock_notified_stock' => null])->save();
            }

            return;
        }

        // A Draft size is not sold yet, so it is never low.
        if ($variant->low_stock_notified_at !== null || ! self::isSold($product) || $variant->isDraft()) {
            return;
        }

        Notification::send(
            User::query()->where('role', UserRole::Specialist)->get(),
            new LowStockAlert($variant),
        );

        $variant->forceFill(['low_stock_notified_at' => now(), 'low_stock_notified_stock' => $variant->stock_on_hand])->save();
    }

    /**
     * After the Specialist changes the safety stock: the Reorder Points are
     * worked out again, and variants now above theirs can be warned again
     * later. No warning is sent here.
     */
    public function rearm(Product $product): void
    {
        $this->reorderPoints->refreshAll($product);

        $product->variants()
            ->whereNotNull('low_stock_notified_at')
            ->whereRaw(ProductVariant::FREE_TO_SELL_SQL.' > product_variants.reorder_point')
            ->update(['low_stock_notified_at' => null, 'low_stock_notified_stock' => null]);
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
