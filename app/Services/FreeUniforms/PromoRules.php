<?php

namespace App\Services\FreeUniforms;

use App\Services\Settings\SystemSettings;

/**
 * The enrollment promo: students who enroll together in a group of at
 * least a few (a Maintenance setting, 5 by default) each get one uniform
 * set for free.
 */
final class PromoRules
{
    /** The fewest students a group needs for the free sets. */
    public static function groupSize(): int
    {
        return SystemSettings::integer(SystemSettings::PROMO_GROUP_SIZE);
    }
}
