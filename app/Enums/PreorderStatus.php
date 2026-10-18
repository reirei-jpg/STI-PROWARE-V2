<?php

namespace App\Enums;

/**
 * Whether a student's preorder still counts.
 */
enum PreorderStatus: string
{
    /** Counted in the Specialist's preorder totals. */
    case Active = 'active';

    /** The student cancelled it; it is no longer counted. */
    case Cancelled = 'cancelled';

    /**
     * The product arrived and is for sale; the student was told. It no
     * longer counts as still to order.
     */
    case Arrived = 'arrived';

    /**
     * The size was sold out and the Specialist said it will not be
     * restocked; the student was told and it no longer counts.
     */
    case NotRestocked = 'not_restocked';

    public function label(): string
    {
        return match ($this) {
            self::Active => 'Preordered',
            self::Cancelled => 'Cancelled',
            self::Arrived => 'Arrived',
            self::NotRestocked => 'Not restocked',
        };
    }
}
