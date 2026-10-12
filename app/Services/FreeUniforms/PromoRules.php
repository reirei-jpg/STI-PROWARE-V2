<?php

namespace App\Services\FreeUniforms;

use App\Models\Setting;

/**
 * The enrollment promo: students who enroll together in a group of at
 * least a few (the Specialist's setting, 5 by default) each get one
 * uniform set for free.
 */
final class PromoRules
{
    public const DEFAULT_GROUP_SIZE = 5;

    public const MIN_GROUP_SIZE = 2;

    public const MAX_GROUP_SIZE = 10;

    /** The fewest students a group needs for the free sets. */
    public static function groupSize(): int
    {
        return max(self::MIN_GROUP_SIZE, min(self::MAX_GROUP_SIZE, Setting::integer(Setting::PROMO_GROUP_SIZE, self::DEFAULT_GROUP_SIZE)));
    }
}
