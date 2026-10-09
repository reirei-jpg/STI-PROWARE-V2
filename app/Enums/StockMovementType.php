<?php

namespace App\Enums;

/**
 * What changed a variant's stock.
 */
enum StockMovementType: string
{
    /** Items that arrived from Head Office were added to stock. */
    case Delivery = 'delivery';

    /** The Specialist corrected the stock, with a reason. */
    case Correction = 'correction';

    /** The Specialist released a student's order: the pieces left the shelf. */
    case Sale = 'sale';

    /**
     * An order was cancelled; its pieces went back to stock. Only for orders
     * placed before orders held their items (they now leave at release).
     */
    case OrderCancelled = 'order_cancelled';

    /** A release marked by mistake was undone the same day: the pieces are back on the shelf, held again. */
    case ReleaseUndone = 'release_undone';

    /** An open order placed before holds existed: its pieces went back on the shelf, held for it. */
    case ConvertedToHeld = 'converted_to_held';

    public function label(): string
    {
        return match ($this) {
            self::Delivery => 'Delivery',
            self::Correction => 'Correction',
            self::Sale => 'Sale',
            self::OrderCancelled => 'Order cancelled',
            self::ReleaseUndone => 'Release undone',
            self::ConvertedToHeld => 'Changed to held',
        };
    }
}
