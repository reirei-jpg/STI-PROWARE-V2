<?php

namespace App\Actions\Stock;

use App\Enums\StockCorrectionReason;
use App\Enums\StockMovementType;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Corrects a variant's stock: takes damaged, lost or returned pieces out,
 * or sets it to the count on the shelf. The correction is kept in the stock
 * history with its reason, note and who made it.
 */
class CorrectStock
{
    /**
     * @param  int  $amount  pieces to take out, or the actual count on the shelf, depending on the reason
     */
    public function handle(ProductVariant $variant, User $correctedBy, StockCorrectionReason $reason, int $amount, ?string $note): StockMovement
    {
        return DB::transaction(function () use ($variant, $correctedBy, $reason, $amount, $note): StockMovement {
            // Lock the variant so a delivery saved at the same moment cannot
            // be lost between reading and writing the balance.
            $locked = ProductVariant::query()->lockForUpdate()->findOrFail($variant->id);
            $change = $reason->removesPieces() ? -$amount : $amount - $locked->stock_on_hand;
            $balance = $locked->stock_on_hand + $change;

            if ($change === 0 || $balance < 0) {
                throw ValidationException::withMessages([
                    $reason->removesPieces() ? 'pieces_to_remove' : 'actual_count' => 'The stock changed while you were typing. Please check it again.',
                ]);
            }

            $locked->forceFill(['stock_on_hand' => $balance])->save();

            return $locked->stockMovements()->create([
                'type' => StockMovementType::Correction,
                'quantity' => $change,
                'balance_after' => $balance,
                'reason' => $reason,
                'note' => $note,
                'recorded_by' => $correctedBy->id,
            ]);
        });
    }
}
