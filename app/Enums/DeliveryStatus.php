<?php

namespace App\Enums;

/**
 * How far an order's delivery has come.
 */
enum DeliveryStatus: string
{
    /** Nothing has arrived yet. */
    case Awaiting = 'awaiting';

    /** Some items have arrived; the rest are still to come. */
    case PartiallyReceived = 'partially_received';

    /** Everything that was ordered has arrived. */
    case Completed = 'completed';

    /** Closed by the Specialist with a reason although not everything arrived. */
    case CompletedShort = 'completed_short';

    public function label(): string
    {
        return match ($this) {
            self::Awaiting => 'Awaiting Delivery',
            self::PartiallyReceived => 'Partially Received',
            self::Completed => 'Completed',
            self::CompletedShort => 'Completed (short)',
        };
    }

    /**
     * Whether more items can still arrive for the order.
     */
    public function isOpen(): bool
    {
        return $this === self::Awaiting || $this === self::PartiallyReceived;
    }
}
