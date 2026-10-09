<?php

namespace App\Enums;

/**
 * Why the Specialist corrected a variant's stock. Damaged, Lost, Returned
 * to Head Office and Given free (promo) take pieces out of stock; Recount
 * and Other set the stock to the number actually on the shelf.
 */
enum StockCorrectionReason: string
{
    case Damaged = 'damaged';
    case Lost = 'lost';
    case Recount = 'recount';
    case ReturnedToHeadOffice = 'returned_to_head_office';

    /** A free uniform from an enrollment promo: no money, to a named student. */
    case GivenFree = 'given_free';

    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::Damaged => 'Damaged',
            self::Lost => 'Lost',
            self::Recount => 'Recount',
            self::ReturnedToHeadOffice => 'Returned to Head Office',
            self::GivenFree => 'Given free (promo)',
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
            self::Damaged, self::Lost, self::ReturnedToHeadOffice, self::GivenFree => true,
            self::Recount, self::Other => false,
        };
    }

    /**
     * True when the student who received them (name and enrollment form #)
     * must be written down.
     */
    public function needsRecipient(): bool
    {
        return $this === self::GivenFree;
    }
}
