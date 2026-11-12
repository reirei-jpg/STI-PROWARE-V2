<?php

namespace App\Enums;

/**
 * Where a buyer's order is. The buyer pays at the cashier, then shows the
 * receipt and the issuance slip at the PROWARE office, where it is released.
 * An order does not hold stock: whoever pays first gets it.
 */
enum OrderStatus: string
{
    /** Placed by the buyer; waiting for them to pay and pick it up. */
    case Placed = 'placed';

    /**
     * Released: the Specialist checked the receipt and the issuance slip,
     * and the items left the shelf.
     */
    case PickedUp = 'picked_up';

    /** Cancelled by the buyer or the Specialist. */
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Placed => 'Waiting for payment',
            self::PickedUp => 'Released',
            self::Cancelled => 'Cancelled',
        };
    }

    /**
     * How the Specialist's screens name it (the same words as the buyer's).
     */
    public function staffLabel(): string
    {
        return $this->label();
    }

    /**
     * Still waiting to be paid for and released.
     */
    public function isOpen(): bool
    {
        return $this === self::Placed;
    }
}
