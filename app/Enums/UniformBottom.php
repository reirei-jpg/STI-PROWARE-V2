<?php

namespace App\Enums;

/**
 * The bottom of a free uniform set: the pants with the polo (male
 * students), the ladies' pants or the skirt with the blouse (female
 * students). Skirts and ladies' pants are only for female students.
 */
enum UniformBottom: string
{
    case Pants = 'pants';
    case LadiesPants = 'ladies_pants';
    case Skirt = 'skirt';

    public function label(): string
    {
        return match ($this) {
            self::Pants => 'Pants',
            self::LadiesPants => "Ladies' Pants",
            self::Skirt => 'Skirt',
        };
    }

    /**
     * The bottoms that go with the top.
     *
     * @return list<self>
     */
    public static function forTop(UniformTop $top): array
    {
        return $top === UniformTop::Polo ? [self::Pants] : [self::LadiesPants, self::Skirt];
    }
}
