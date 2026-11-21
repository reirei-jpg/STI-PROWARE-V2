<?php

namespace App\Enums;

/**
 * How the buyer paid the cashier. GCash is recorded as a choice with its
 * 13-digit reference number; the system is not connected to GCash itself.
 */
enum PaymentMethod: string
{
    case Cash = 'cash';
    case GCash = 'gcash';

    public function label(): string
    {
        return match ($this) {
            self::Cash => 'Cash',
            self::GCash => 'GCash',
        };
    }
}
