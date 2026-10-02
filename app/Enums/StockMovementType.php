<?php

namespace App\Enums;

/**
 * What changed a variant's stock.
 */
enum StockMovementType: string
{
    /** Items that arrived from Head Office were added to stock. */
    case Delivery = 'delivery';

    public function label(): string
    {
        return match ($this) {
            self::Delivery => 'Delivery',
        };
    }
}
