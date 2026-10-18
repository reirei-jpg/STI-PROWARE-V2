<?php

namespace App\Actions\Preorders;

use App\Enums\PreorderStatus;
use App\Enums\UserRole;
use App\Models\Preorder;
use App\Models\Product;
use App\Models\User;
use App\Notifications\PreorderPlaced;
use App\Services\Stock\LowStockAlerts;
use Illuminate\Support\Facades\Notification;

/**
 * A student preorders a size or color (website or phone app): of a Preorder
 * product, or a sold-out size of a product for sale. Preordering the same
 * one again changes how many, so a student has one active preorder per size
 * or color. A new preorder of a sold-out size is sent to the Specialist, so
 * she can order more.
 */
class PlacePreorder
{
    public function handle(User $student, Product $product, int $variantId, int $quantity): Preorder
    {
        $preorder = $student->preorders()->updateOrCreate(
            [
                'product_variant_id' => $variantId,
                'status' => PreorderStatus::Active,
            ],
            [
                'product_id' => $product->id,
                'quantity' => $quantity,
            ],
        );

        if ($preorder->wasRecentlyCreated && LowStockAlerts::isSold($product)) {
            Notification::send(
                User::query()->where('role', UserRole::Specialist)->get(),
                new PreorderPlaced($preorder->setRelations(['product' => $product, 'student' => $student])),
            );
        }

        return $preorder;
    }

    /**
     * "Your preorder of 2 × 42nd Anniversary Shirt (S/M) has been placed. It is listed in My Preorders."
     * For a sold-out size it also says the student will be notified when it is back in stock.
     */
    public static function message(Preorder $preorder, Product $product): string
    {
        $variant = $preorder->variant;

        return "Your preorder of {$preorder->quantity} × {$product->name}".($variant->choices === [] ? '' : " ({$variant->label()})").' has been placed.'
            .(LowStockAlerts::isSold($product) ? ' You will be notified when it is back in stock.' : '')
            .' It is listed in My Preorders.';
    }
}
