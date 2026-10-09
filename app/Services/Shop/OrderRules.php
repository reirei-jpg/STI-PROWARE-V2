<?php

namespace App\Services\Shop;

use App\Models\Setting;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * How long an order holds its items, and the guards that stop anyone from
 * holding items without buying them (website and phone app):
 *
 * - An order holds its items for a few days (the Specialist's setting, 2 by
 *   default); not released by then, it expires and the items are free to
 *   sell again.
 * - A student can have only a few orders waiting at once.
 * - A student whose orders expired several times in a month cannot order
 *   for a week, unless the Specialist lifts the pause.
 */
final class OrderRules
{
    public const DEFAULT_HOLD_DAYS = 2;

    public const MIN_HOLD_DAYS = 1;

    public const MAX_HOLD_DAYS = 3;

    public const MAX_OPEN_ORDERS = 2;

    /** Expired orders in NO_SHOW_WINDOW_DAYS that pause ordering. */
    public const NO_SHOW_LIMIT = 3;

    public const NO_SHOW_WINDOW_DAYS = 30;

    public const PAUSE_DAYS = 7;

    /** Days an order holds its items (the Specialist's setting). */
    public static function holdDays(): int
    {
        return max(self::MIN_HOLD_DAYS, min(self::MAX_HOLD_DAYS, Setting::integer(Setting::ORDER_HOLD_DAYS, self::DEFAULT_HOLD_DAYS)));
    }

    /** The last moment an order placed now can be released. */
    public static function holdUntil(): CarbonImmutable
    {
        return now()->addDays(self::holdDays())->endOfDay();
    }

    /**
     * Why the student cannot place another order now; null when they can.
     */
    public static function refusal(User $student): ?string
    {
        $open = $student->orders()->open()->count();

        if ($open >= self::MAX_OPEN_ORDERS) {
            return "You already have {$open} orders waiting for pickup. Pick them up or cancel one before placing another.";
        }

        $pausedUntil = self::pausedUntil($student);

        if ($pausedUntil !== null) {
            return 'Ordering is paused until '.$pausedUntil->format('M j, Y').', because '.self::NO_SHOW_LIMIT.' of your orders expired without being picked up. Ask the PROWARE office if this is a mistake.';
        }

        return null;
    }

    /**
     * When the student can order again after too many expired orders; null
     * when they are not paused. Expiries before the Specialist lifted a
     * pause do not count.
     */
    public static function pausedUntil(User $student): ?CarbonImmutable
    {
        $expiries = $student->orders()
            ->whereNotNull('expired_at')
            ->where('expired_at', '>=', now()->subDays(self::NO_SHOW_WINDOW_DAYS))
            ->when($student->ordering_resumed_at, fn ($query, $resumedAt) => $query->where('expired_at', '>', $resumedAt))
            ->latest('expired_at')
            ->limit(self::NO_SHOW_LIMIT)
            ->pluck('expired_at');

        if ($expiries->count() < self::NO_SHOW_LIMIT) {
            return null;
        }

        $until = CarbonImmutable::parse($expiries->first())->addDays(self::PAUSE_DAYS);

        return $until->isFuture() ? $until : null;
    }

    /**
     * The Specialist lets a paused student order again.
     */
    public static function liftPause(User $student): void
    {
        $student->forceFill(['ordering_resumed_at' => now()])->save();
    }
}
