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

    /** A student ordered it; the pieces are held for them. */
    case Sale = 'sale';

    /** An order was cancelled; its pieces went back to stock. */
    case OrderCancelled = 'order_cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Delivery => 'Delivery',
            self::Correction => 'Correction',
            self::Sale => 'Sale',
            self::OrderCancelled => 'Order cancelled',
        };
    }
}
