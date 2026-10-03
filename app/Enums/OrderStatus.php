<?php

namespace App\Enums;

/**
 * Where a student's order is. Students pay in cash at the PROWARE office
 * when they pick it up.
 */
enum OrderStatus: string
{
    /** The student placed it; the stock is held for them. */
    case Placed = 'placed';

    /** The Specialist prepared it; the student can pick it up. */
    case Ready = 'ready';

    /** The student paid in cash and took the items. */
    case PickedUp = 'picked_up';

    /** Cancelled by the student, the Specialist, or because it was not picked up in time; the stock went back. */
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Placed => 'Placed',
            self::Ready => 'Ready for pickup',
            self::PickedUp => 'Picked up',
            self::Cancelled => 'Cancelled',
        };
    }

    /**
     * Still waiting to be picked up, so the stock is held.
     */
    public function isOpen(): bool
    {
        return $this === self::Placed || $this === self::Ready;
    }
}
