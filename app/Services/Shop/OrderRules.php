<?php

namespace App\Services\Shop;

use App\Models\Setting;
use App\Models\User;
use App\Notifications\OrderingResumed;
use App\Services\Settings\SystemSettings;
use Carbon\CarbonImmutable;

/**
 * How long an order holds its items, and the guards that stop anyone from
 * holding items without buying them (website and phone app):
 *
 * - An order holds its items for a few days (the Specialist's setting, 2 by
 *   default); not released by then, it expires and the items are free to
 *   sell again.
 * - A student whose orders expired several times recently cannot order
 *   for a while, unless the Specialist lifts the pause (how many, how
 *   recently and how long are the Specialist's settings).
 *
 * There is no limit on how many orders a student has waiting at once; the
 * expiry and the pause are the guards.
 */
final class OrderRules
{
    /** Days an order holds its items (the Specialist's setting). */
    public static function holdDays(): int
    {
        return SystemSettings::integer(Setting::ORDER_HOLD_DAYS);
    }

    /** Expired orders (within the window) that pause ordering. */
    public static function noShowLimit(): int
    {
        return SystemSettings::integer(Setting::ORDER_PAUSE_AFTER_EXPIRED);
    }

    /** How many days back expired orders count toward the pause. */
    public static function noShowWindowDays(): int
    {
        return SystemSettings::integer(Setting::ORDER_PAUSE_WINDOW_DAYS);
    }

    /** How long ordering is paused, from the last expired order. */
    public static function pauseDays(): int
    {
        return SystemSettings::integer(Setting::ORDER_PAUSE_DAYS);
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
            return 'Ordering is paused until '.$pausedUntil->format('M j, Y').', because '.self::noShowLimit().' of your orders expired without being picked up. Ask the PROWARE office if this is a mistake.';
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
            ->where('expired_at', '>=', now()->subDays(self::noShowWindowDays()))
            ->when($student->ordering_resumed_at, fn ($query, $resumedAt) => $query->where('expired_at', '>', $resumedAt))
            ->latest('expired_at')
            ->limit(self::noShowLimit())
            ->pluck('expired_at');

        if ($expiries->count() < self::noShowLimit()) {
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
            ->whereHas('orders', fn ($orders) => $orders->whereNotNull('expired_at')->where('expired_at', '>=', now()->subDays(self::noShowWindowDays())), '>=', self::noShowLimit())
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
        $student->notify(new OrderingResumed);
    }
}
