<?php

namespace App\Enums;

/**
 * Where a product appears on the storefront. The Specialist chooses it.
 */
enum ProductStatus: string
{
    /** Not shown to students yet. */
    case Draft = 'draft';

    /** Shown under Coming Soon; students can preorder it. */
    case Preorder = 'preorder';

    /** Shown in All Merchandise; students can add it to their cart. */
    case Available = 'available';

    /** Slow-moving stock being cleared: shown under On Sale at a lower price. */
    case OnSale = 'on_sale';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::Preorder => 'Preorder',
            self::Available => 'Available',
            self::OnSale => 'On Sale',
        };
    }
}
