<?php

namespace App\Services\Shop;

use App\Models\User;
use App\Services\Settings\SystemSettings;
use Carbon\CarbonImmutable;

/**
 * How long an order holds its items, and the guards that stop anyone from
 * holding items without buying them (website and phone app):
 *
 * - An order holds its items for a few days (a Maintenance setting, 2 by
 *   default); not released by then, it expires and the items are free to
 *   sell again.
 * - A student whose orders expired several times in a month (3 by default)
 *   cannot order for a while (7 days by default), unless the Specialist
 *   lifts the pause. Both are Maintenance settings.
 *
 * There is no limit on how many orders a student has waiting at once; the
 * expiry and the pause are the guards.
 */
final class OrderRules
{
    /** The days in which expired orders are counted for a pause. */
    public const NO_SHOW_WINDOW_DAYS = 30;

    /** Days an order holds its items (Maintenance). */
    public static function holdDays(): int
    {
        return SystemSettings::integer(SystemSettings::ORDER_HOLD_DAYS);
    }

    /** Expired orders within NO_SHOW_WINDOW_DAYS that pause ordering (Maintenance). */
    public static function pauseAfterExpired(): int
    {
        return SystemSettings::integer(SystemSettings::ORDER_PAUSE_AFTER_EXPIRED);
    }

    /** Days a paused student cannot order (Maintenance). */
    public static function pauseDays(): int
    {
        return SystemSettings::integer(SystemSettings::ORDER_PAUSE_DAYS);
    }

    /** The last moment an order placed now can be released. */
    public static function holdUntil(): CarbonImmutable
    {
        return now()->addDays(self::holdDays())->endOfDay();
    }

    /**
     * Why the student cannot place another order now (ordering is paused);
     * null when they can.
     */
    public static function refusal(User $student): ?string
    {
        $pausedUntil = self::pausedUntil($student);

        if ($pausedUntil !== null) {
            return 'Ordering is paused until '.$pausedUntil->format('M j, Y').', because '.self::pauseAfterExpired().' of your orders expired without being picked up. Ask the PROWARE office if this is a mistake.';
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
        $limit = self::pauseAfterExpired();
        $expiries = $student->orders()
            ->whereNotNull('expired_at')
            ->where('expired_at', '>=', now()->subDays(self::NO_SHOW_WINDOW_DAYS))
            ->when($student->ordering_resumed_at, fn ($query, $resumedAt) => $query->where('expired_at', '>', $resumedAt))
            ->latest('expired_at')
            ->limit($limit)
            ->pluck('expired_at');

        if ($expiries->count() < $limit) {
            return null;
        }

        $until = CarbonImmutable::parse($expiries->first())->addDays(self::pauseDays());

        return $until->isFuture() ? $until : null;
    }

    /**
     * Students who cannot order now because of expired orders, for the
     * Specialist's Orders page, the soonest to be able to order again first.
     *
     * @return list<array{id: int, name: string, email: string, paused_until: string}>
     */
    public static function pausedStudents(): array
    {
        $candidates = User::query()
            ->whereHas('orders', fn ($orders) => $orders->whereNotNull('expired_at')->where('expired_at', '>=', now()->subDays(self::NO_SHOW_WINDOW_DAYS)), '>=', self::pauseAfterExpired())
            ->orderBy('name')
            ->get();

        return array_values($candidates
            ->map(fn (User $student): array => ['student' => $student, 'until' => self::pausedUntil($student)])
            ->filter(fn (array $row): bool => $row['until'] !== null)
            ->sortBy(fn (array $row): string => $row['until']->toIso8601String())
            ->map(fn (array $row): array => [
                'id' => $row['student']->id,
                'name' => $row['student']->name,
                'email' => $row['student']->email,
                'paused_until' => $row['until']->toDateString(),
            ])
            ->all());
    }

    /**
     * The Specialist lets a paused student order again.
     */
    public static function liftPause(User $student): void
    {
        $student->forceFill(['ordering_resumed_at' => now()])->save();
    }
}
