<?php

namespace App\Enums;

/**
 * Where a buyer's order is. The buyer pays at the cashier, who scans the
 * issuance slip and marks it Paid: what is left of its items is set aside
 * for them then (first to pay, first served). The Specialist then releases
 * it at the PROWARE office (panel revision, 20 Nov 2026).
 */
enum OrderStatus: string
{
    /** Placed by the buyer; waiting for them to pay at the cashier. */
    case Placed = 'placed';

    /**
     * Paid at the cashier: its items (what was left of them) are set aside
     * for the buyer until the Specialist releases them. It can no longer be
     * cancelled.
     */
    case Paid = 'paid';

    /**
     * Released: the Specialist handed the paid items over, and they left the
     * shelf.
     */
    case PickedUp = 'picked_up';

    /** Cancelled by the buyer before paying. */
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Placed => 'Waiting for payment',
            self::Paid => 'Paid · ready to release',
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
     * Not released or cancelled yet (waiting for payment, or paid and
     * waiting for release).
     */
    public function isOpen(): bool
    {
        return $this === self::Placed || $this === self::Paid;
    }
}
