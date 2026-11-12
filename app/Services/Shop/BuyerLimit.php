<?php

namespace App\Services\Shop;

use App\Models\Setting;
use App\Models\User;

/**
 * The most of one item a buyer can get at once: per cart line (pieces,
 * packs or uniform sets) and per size or color preordered in all. It is
 * the Specialist's Maintenance setting (99 by default), unless the
 * Specialist allowed this buyer more, e.g. 500 shirts for an event. An
 * item in stock also stops at its stock.
 */
final class BuyerLimit
{
    public const DEFAULT = 99;

    public const MIN = 1;

    public const MAX = 10000;

    /** The limit for every buyer the Specialist has not allowed more. */
    public static function everyone(): int
    {
        return max(self::MIN, min(self::MAX, Setting::integer(Setting::MOST_PER_ITEM, self::DEFAULT)));
    }

    public static function for(?User $buyer): int
    {
        return $buyer->most_per_item ?? self::everyone();
    }

    /**
     * "You can get at most 99 of one item. Contact the PROWARE office to get more."
     */
    public static function message(int $most): string
    {
        return 'You can get at most '.number_format($most).' of one item. Contact the PROWARE office to get more.';
    }
}
