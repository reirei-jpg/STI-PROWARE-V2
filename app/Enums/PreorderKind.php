<?php

namespace App\Enums;

/**
 * What a preorder is (panel revision A2): a Preorder of a Coming Soon item,
 * or a Back Order of a size already sold in the store that is sold out.
 */
enum PreorderKind: string
{
    case Preorder = 'preorder';

    case BackOrder = 'back_order';

    public function label(): string
    {
        return match ($this) {
            self::Preorder => 'Preorder',
            self::BackOrder => 'Back order',
        };
    }
}
