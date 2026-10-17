<?php

namespace App\Services\FreeUniforms;

use App\Models\Setting;
use App\Services\Settings\SystemSettings;

/**
 * The enrollment promo: students who enroll together in a group of at
 * least a few (the Specialist's setting, 5 by default) each get one
 * uniform set for free.
 */
final class PromoRules
{
    /** The fewest students a group needs for the free sets. */
    public static function groupSize(): int
    {
        return SystemSettings::integer(Setting::PROMO_GROUP_SIZE);
    }
}
