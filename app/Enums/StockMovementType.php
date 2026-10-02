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

    public function label(): string
    {
        return match ($this) {
            self::Delivery => 'Delivery',
            self::Correction => 'Correction',
        };
    }
}
