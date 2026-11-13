<?php

namespace App\Actions\Preorders;

use App\Enums\PreorderStatus;
use App\Models\Preorder;
use App\Models\ProductVariant;
use App\Services\Preorders\EarlyBird;
use App\Services\Preorders\PreorderPayment;
use App\Services\Stock\LowStockAlerts;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * A buyer changes the size, color or quantity of their own preorder (website
 * and phone app), while it is still waiting and could still be cancelled.
 *
 * To stay fair to everyone waiting: only lowering the quantity keeps its
 * place in line; raising it or changing the size or color moves it to the
 * end of the line, as if it were preordered again. Early-bird pieces it
 * already has stay with it, up to the new quantity; the rest go to the next
 * preorders in line.
 */
class EditPreorderByStudent
{
    /**
     * Why the buyer cannot change the preorder now; null when they can.
     */
    public static function refusal(Preorder $preorder): ?string
    {
        if ($preorder->status === PreorderStatus::Active && PreorderPayment::isPaid($preorder)) {
            return "You already paid for your preorder of {$preorder->product->name}, so it can no longer be changed.";
        }

        if ($preorder->status === PreorderStatus::Active && ($preorder->product->acceptsPreorders() || LowStockAlerts::isSold($preorder->product))) {
            return null;
        }

        return match ($preorder->status) {
            PreorderStatus::Held => "The pieces of your preorder for {$preorder->product->name} are already held for you. To get fewer, order fewer with Order now.",
            PreorderStatus::Cancelled => "Your preorder for {$preorder->product->name} is cancelled, so it cannot be changed.",
            PreorderStatus::Ordered => "You already ordered this preorder for {$preorder->product->name}, so it cannot be changed.",
            PreorderStatus::Active, PreorderStatus::Arrived => "Preorders for {$preorder->product->name} are closed, so this preorder can no longer be changed here. Ask the PROWARE office.",
            default => "Your preorder for {$preorder->product->name} is closed, so it cannot be changed.",
        };
    }

    /**
     * Raising the quantity or changing the size or color moves it to the
     * end of the line.
     */
    public static function movesToEnd(Preorder $preorder, int $variantId, int $quantity): bool
    {
        return $variantId !== $preorder->product_variant_id || $quantity > $preorder->quantity;
    }

    /**
     * @return bool whether it moved to the end of the line
     *
     * @throws ValidationException when it can no longer be changed
     */
    public function handle(Preorder $preorder, ProductVariant $variant, int $quantity): bool
    {
        $refusal = self::refusal($preorder);

        if ($refusal !== null) {
            throw ValidationException::withMessages(['preorder' => $refusal]);
        }

        $moves = self::movesToEnd($preorder, $variant->id, $quantity);

        DB::transaction(function () use ($preorder, $variant, $quantity, $moves): void {
            $preorder->forceFill([
                'product_variant_id' => $variant->id,
                'quantity' => $quantity,
                'early_bird_pieces' => min($preorder->early_bird_pieces, $quantity),
                'edited_at' => now(),
                // Its place in line is when it was preordered: now, at the end.
                ...($moves ? ['created_at' => now()] : []),
            ])->save();

            EarlyBird::reallocate($preorder->product);
        });

        return $moves;
    }

    /**
     * "Your preorder has been changed: 2 × Test Product (M/Navy Blue)."
     */
    public static function message(Preorder $preorder, bool $moved): string
    {
        $preorder->load('variant.product');

        return "Your preorder has been changed: {$preorder->quantity} × {$preorder->variant->displayName()}."
            .($moved ? ' It is now at the end of the line.' : ' It keeps its place in line.');
    }
}
