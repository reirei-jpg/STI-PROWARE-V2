<?php

namespace App\Services\FreeUniforms;

use App\Enums\StockMovementType;
use App\Models\FreeUniformStudent;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Models\User;
use App\Services\Stock\LowStockAlerts;
use App\Services\Stock\StockCost;

/**
 * Takes the pieces of a free uniform set out of stock, one piece each, as
 * "Free (promo)": never counted as a sale or as money. A piece is given
 * only from what is free to sell (pieces held for students' orders stay
 * held); otherwise it is still to give.
 */
class FreeUniformStock
{
    public function __construct(private LowStockAlerts $lowStockAlerts) {}

    /**
     * Give the student's top and pants that are not given yet. Call inside
     * a transaction.
     *
     * @return array{given: int, still_to_give: list<string>} pieces given, and what is still to give (e.g. "Polo M")
     */
    public function giveMissing(FreeUniformStudent $student, User $givenBy): array
    {
        $given = 0;
        $stillToGive = [];

        foreach (['top' => $student->top_variant_id, 'pants' => $student->pants_variant_id] as $piece => $variantId) {
            if ($student->getAttribute("{$piece}_movement_id") !== null) {
                continue;
            }

            $movement = $this->giveOne($variantId, $student, $givenBy);

            if ($movement === null) {
                $stillToGive[] = self::pieceName($student, $piece);

                continue;
            }

            $student->setAttribute("{$piece}_movement_id", $movement->id);
            $given++;
        }

        $student->save();

        return ['given' => $given, 'still_to_give' => $stillToGive];
    }

    /**
     * "Polo M" or "Pants 30": the piece and its size.
     *
     * @param  'top'|'pants'  $piece
     */
    public static function pieceName(FreeUniformStudent $student, string $piece): string
    {
        $variant = $piece === 'top' ? $student->topVariant : $student->pantsVariant;
        $name = $piece === 'top' ? $student->top_kind->label() : 'Pants';

        return $variant->choices === [] ? $name : "{$name} {$variant->label()}";
    }

    /**
     * Take one piece of the variant out of stock for the student; null when
     * none is free to sell.
     */
    private function giveOne(int $variantId, FreeUniformStudent $student, User $givenBy): ?StockMovement
    {
        // Lock the variant so an order or a delivery saved at the same
        // moment cannot be lost between reading and writing the balance.
        $variant = ProductVariant::query()->lockForUpdate()->findOrFail($variantId);

        if ($variant->freeToSell() < 1) {
            return null;
        }

        $balance = $variant->stock_on_hand - 1;
        $variant->forceFill(['stock_on_hand' => $balance])->save();

        $movement = $variant->stockMovements()->create([
            'type' => StockMovementType::FreePromo,
            'quantity' => -1,
            'balance_after' => $balance,
            'recipient_name' => $student->name,
            'enrollment_form_number' => $student->enrollment_form_number,
            'note' => "{$student->uniformSet->name} set · Free uniform group #{$student->free_uniform_group_id}",
            'recorded_by' => $givenBy->id,
        ]);

        // The piece given is the oldest on the shelf; it keeps its cost.
        StockCost::replay($variant->id);

        $this->lowStockAlerts->check($variant);

        return $movement;
    }
}
