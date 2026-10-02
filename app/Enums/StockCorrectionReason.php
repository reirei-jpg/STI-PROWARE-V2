<?php

namespace App\Enums;

/**
 * Why the Specialist corrected a variant's stock. Damaged, Lost and
 * Returned to Head Office take pieces out of stock; Recount and Other set
 * the stock to the number actually on the shelf.
 */
enum StockCorrectionReason: string
{
    case Damaged = 'damaged';
    case Lost = 'lost';
    case Recount = 'recount';
    case ReturnedToHeadOffice = 'returned_to_head_office';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::Damaged => 'Damaged',
            self::Lost => 'Lost',
            self::Recount => 'Recount',
            self::ReturnedToHeadOffice => 'Returned to Head Office',
            self::Other => 'Other',
        };
    }

    /**
     * True when the Specialist enters how many pieces to take out; false
     * when she enters the actual count on the shelf.
     */
    public function removesPieces(): bool
    {
        return match ($this) {
            self::Damaged, self::Lost, self::ReturnedToHeadOffice => true,
            self::Recount, self::Other => false,
        };
    }
}
