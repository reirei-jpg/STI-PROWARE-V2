<?php

namespace App\Enums;

/**
 * The top of a free uniform set: a blouse for female students, a polo for
 * male students.
 */
enum UniformTop: string
{
    case Blouse = 'blouse';
    case Polo = 'polo';

    public function label(): string
    {
        return match ($this) {
            self::Blouse => 'Blouse',
            self::Polo => 'Polo',
        };
    }
}
