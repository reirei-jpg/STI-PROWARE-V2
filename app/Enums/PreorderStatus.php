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

    /**
     * Its pieces arrived and are held for the student until held_until
     * (24 hours after they were told). Not counted as still to order.
     */
    case Held = 'held';

    /**
     * It was not paid by the close date of the payment dates, so it was
     * dropped and is no longer counted.
     */
    case NotPaid = 'not_paid';

    /** The student ordered the held pieces (order_id). */
    case Ordered = 'ordered';

    /**
     * The student did not order the held pieces in time; they went to the
     * next buyer waiting (or on sale to everyone).
     */
    case HoldEnded = 'hold_ended';

    public function label(): string
    {
        return match ($this) {
            self::Active => 'Preordered',
            self::Cancelled => 'Cancelled',
            self::Arrived => 'Arrived',
            self::NotRestocked => 'Not restocked',
            self::Held => 'Held for you',
            self::Ordered => 'Ordered',
            self::HoldEnded => 'Hold ended',
            self::NotPaid => 'Not paid in time',
        };
    }

    /**
     * Counted as Arrived on the Specialist's screens: also the ones whose
     * pieces arrived and were held, ordered or not ordered in time.
     *
     * @return list<self>
     */
    public static function arrivedGroup(): array
    {
        return [self::Arrived, self::Held, self::Ordered, self::HoldEnded];
    }

    /** The label on the Specialist's screens ("Held for the buyer"). */
    public function staffLabel(): string
    {
        return $this === self::Held ? 'Held for the buyer' : $this->label();
    }
}
