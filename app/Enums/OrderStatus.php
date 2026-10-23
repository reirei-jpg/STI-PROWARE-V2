<?php

namespace App\Enums;

/**
 * Where a student's order is. Students pay at the cashier and show the
 * receipt at the PROWARE office when they pick it up.
 */
enum OrderStatus: string
{
    /** The student placed it; its items are held for them. */
    case Placed = 'placed';

    /** The Specialist prepared it; the student can pick it up. */
    case Ready = 'ready';

    /**
     * Released: the Specialist scanned the issuance slip, the student paid
     * and received the items, and they left the shelf.
     */
    case PickedUp = 'picked_up';

    /** Cancelled by the student, the Specialist, or because it was not released in time; its hold ended. */
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Placed => 'Placed',
            self::Ready => 'Ready for pickup',
            self::PickedUp => 'Released',
            self::Cancelled => 'Cancelled',
        };
    }

    /**
     * How the Specialist's screens name it: a just-placed order is "New"
     * (to prepare), as on the Student Orders tab and the dashboard card.
     * Students keep "Placed".
     */
    public function staffLabel(): string
    {
        return $this === self::Placed ? 'New' : $this->label();
    }

    /**
     * Still waiting to be released, so its items are held.
     */
    public function isOpen(): bool
    {
        return $this === self::Placed || $this === self::Ready;
    }
}
