<?php

namespace App\Actions\Preorders;

use App\Enums\PreorderStatus;
use App\Models\Preorder;
use App\Models\Product;
use App\Models\User;

/**
 * A student preorders a size or color of a Preorder product (website or
 * phone app). Preordering the same one again changes how many, so a student
 * has one active preorder per size or color.
 */
class PlacePreorder
{
    public function handle(User $student, Product $product, int $variantId, int $quantity): Preorder
    {
        return $student->preorders()->updateOrCreate(
            [
                'product_variant_id' => $variantId,
                'status' => PreorderStatus::Active,
            ],
            [
                'product_id' => $product->id,
                'quantity' => $quantity,
            ],
        );
    }

    /**
     * "Preordered 2 × 42nd Anniversary Shirt (S/M). You can see it in My Preorders."
     */
    public static function message(Preorder $preorder, Product $product): string
    {
        $variant = $preorder->variant;

        return "Preordered {$preorder->quantity} × {$product->name}".($variant->choices === [] ? '' : " ({$variant->label()})").'. You can see it in My Preorders.';
    }
}
