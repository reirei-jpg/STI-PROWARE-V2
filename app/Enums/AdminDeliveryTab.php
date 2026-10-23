<?php

namespace App\Enums;

/**
 * The three tabs of the School Admin's Deliveries list, by what has arrived
 * for each eStore order.
 */
enum AdminDeliveryTab: string
{
    /** Uploaded, nothing has arrived yet. */
    case Coming = 'coming';

    /** Some items have arrived; the rest are still to come. */
    case Ongoing = 'ongoing';

    /** Everything arrived, or closed with some missing. */
    case Completed = 'completed';

    /**
     * @return list<DeliveryStatus>
     */
    public function statuses(): array
    {
        return match ($this) {
            self::Coming => [DeliveryStatus::Awaiting],
            self::Ongoing => [DeliveryStatus::PartiallyReceived],
            self::Completed => [DeliveryStatus::Completed, DeliveryStatus::CompletedShort],
        };
    }
}
