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

    /**
     * A free uniform from an enrollment promo, to a named student. Only on
     * corrections made before the Free Uniforms page; it cannot be chosen
     * any more (free uniforms are StockMovementType::FreePromo now).
     */
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
     * The reasons the Specialist can choose in the Correct stock pop-up.
     *
     * @return list<self>
     */
    public static function choosable(): array
    {
        return array_values(array_filter(self::cases(), fn (self $reason): bool => $reason !== self::GivenFree));
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
}
