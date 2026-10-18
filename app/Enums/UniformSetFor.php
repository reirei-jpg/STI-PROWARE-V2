<?php

namespace App\Enums;

/**
 * Who a uniform set bought by a student is for: boys get the polo and the
 * pants; girls get the blouse and the ladies' pants or the skirt.
 */
enum UniformSetFor: string
{
    case Boys = 'boys';
    case Girls = 'girls';

    /** "For Boys", as on the uniform pictures. */
    public function label(): string
    {
        return match ($this) {
            self::Boys => 'For Boys',
            self::Girls => 'For Girls',
        };
    }
}
