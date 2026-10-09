<?php

namespace App\Actions\Stock;

use App\Enums\StockCorrectionReason;
use App\Enums\StockMovementType;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Models\User;
use App\Services\Stock\LowStockAlerts;
use App\Services\Stock\StockCost;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Corrects a variant's stock: takes damaged, lost or returned pieces out,
 * or sets it to the count on the shelf. The correction is kept in the stock
 * history with its reason, note and who made it. A count that adds pieces
 * needs their eStore price per piece, so every piece has a cost.
 */
class CorrectStock
{
    public function __construct(private LowStockAlerts $lowStockAlerts) {}

    /**
     * @param  int  $amount  pieces to take out, or the actual count on the shelf, depending on the reason
     * @param  int|null  $centavosPerPiece  the eStore price per piece, needed when a count adds pieces
     *
     * @throws ValidationException when the stock changed meanwhile, or added pieces have no eStore price
     */
    public function handle(ProductVariant $variant, User $correctedBy, StockCorrectionReason $reason, int $amount, ?string $note, ?int $centavosPerPiece = null): StockMovement
    {
        return DB::transaction(function () use ($variant, $correctedBy, $reason, $amount, $note, $centavosPerPiece): StockMovement {
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

            // No piece enters stock without what it cost on the eStore.
            if ($change > 0 && $centavosPerPiece === null) {
                throw ValidationException::withMessages(['unit_cost' => 'Enter the eStore price per piece of the pieces you are adding.']);
            }

            $locked->forceFill(['stock_on_hand' => $balance])->save();

            $correction = $locked->stockMovements()->create([
                'type' => StockMovementType::Correction,
                'quantity' => $change,
                'balance_after' => $balance,
                'cost_centavos' => $change > 0 ? $centavosPerPiece * $change : null,
                'reason' => $reason,
                'note' => $note,
                'recorded_by' => $correctedBy->id,
            ]);

            // Pieces taken out are the oldest on the shelf; later sales cost the next.
            StockCost::replay($locked->id);

            $this->lowStockAlerts->check($locked);

            return $correction;
        });
    }
}
