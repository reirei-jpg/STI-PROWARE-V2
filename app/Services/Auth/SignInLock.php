<?php

namespace App\Services\Auth;

use App\Enums\UserRole;
use App\Models\AccountLock;
use App\Models\User;
use App\Notifications\AccountLocked;
use App\Notifications\AccountLockedForStaff;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\Notification;

/**
 * Locks an account after 5 wrong passwords in a row, for 15 minutes, on the
 * website and the phone app alike. Unlike the per-minute limit on sign-in
 * requests, the count belongs to the account, so waiting a minute or trying
 * from another phone does not get around it. A correct sign-in starts the
 * count again; the lock ends by itself, with a new password, or when the
 * Specialist (for a buyer) or the School Admin (for the Specialist)
 * unlocks it. Each lock tells the owner and the person who can unlock it.
 */
class SignInLock
{
    public const MAX_WRONG_PASSWORDS = 5;

    public const LOCK_MINUTES = 15;

    /** From this many locks in a day the unlocker is warned of guessing. */
    public const WARN_AFTER_LOCKS = 3;

    /**
     * Why this account cannot sign in right now (even with the right
     * password), or null when it can.
     */
    public static function refusal(User $user): ?string
    {
        // Over at the time the message gives ("Try again at 2:45 PM").
        if (! self::isLocked($user)) {
            return null;
        }

        return self::lockedMessage($user->locked_until);
    }

    /**
     * @phpstan-assert-if-true !null $user->locked_until
     */
    public static function isLocked(User $user): bool
    {
        return $user->locked_until !== null && $user->locked_until->isFuture();
    }

    /**
     * Counts a wrong password. The 5th in a row locks the account, signs it
     * out everywhere (every browser and phone), and tells the owner and whoever can unlock it;
     * then the lock's message is returned, otherwise null.
     */
    public static function wrongPassword(User $user): ?string
    {
        $wrongPasswords = $user->failed_sign_ins + 1;

        if ($wrongPasswords < self::MAX_WRONG_PASSWORDS) {
            $user->forceFill(['failed_sign_ins' => $wrongPasswords])->save();

            return null;
        }

        $lockedUntil = now()->addMinutes(self::LOCK_MINUTES);
        $user->forceFill(['failed_sign_ins' => 0, 'locked_until' => $lockedUntil])->save();
        SignOutOtherDevices::handle($user);
        AccountLock::query()->create(['user_id' => $user->id, 'locked_until' => $lockedUntil]);

        $user->notify(new AccountLocked($lockedUntil));
        Notification::send(self::unlockers($user), new AccountLockedForStaff($user, $lockedUntil, self::locksToday($user)));

        return self::lockedMessage($lockedUntil);
    }

    /**
     * A correct sign-in (or a new password): the count starts again.
     */
    public static function clear(User $user): void
    {
        if ($user->failed_sign_ins > 0 || $user->locked_until !== null) {
            $user->forceFill(['failed_sign_ins' => 0, 'locked_until' => null])->save();
        }
    }

    /**
     * Whether $staff may unlock $owner's account: the Specialist unlocks
     * students and STI staff, the School Admin unlocks the Specialist.
     * Nobody unlocks their own account.
     */
    public static function canUnlock(User $staff, User $owner): bool
    {
        return $staff->id !== $owner->id && match ($staff->role) {
            UserRole::Specialist => $owner->isBuyer(),
            UserRole::SchoolAdmin => $owner->isSpecialist(),
            default => false,
        };
    }

    /**
     * Unlock before the 15 minutes are up; returns the message to show, or
     * why it cannot be done.
     *
     * @return array{unlocked: bool, message: string}
     */
    public static function unlock(User $staff, User $owner): array
    {
        if (! self::isLocked($owner)) {
            return ['unlocked' => false, 'message' => "{$owner->name}'s account is not locked any more. They can sign in now."];
        }

        self::clear($owner);
        AccountLock::query()
            ->where('user_id', $owner->id)
            ->whereNull('unlocked_at')
            ->where('locked_until', '>', now())
            ->update(['unlocked_at' => now(), 'unlocked_by' => $staff->id]);

        return ['unlocked' => true, 'message' => "{$owner->name}'s account has been unlocked. They can sign in now."];
    }

    /**
     * The accounts locked right now that $staff may unlock, the soonest to
     * end first.
     *
     * @return list<array{id: int, name: string, email: string, role_label: string, locked_until: string, locks_today: int}>
     */
    public static function lockedFor(User $staff): array
    {
        $roles = match ($staff->role) {
            UserRole::Specialist => [UserRole::Student, UserRole::Employee],
            UserRole::SchoolAdmin => [UserRole::Specialist],
            default => [],
        };

        if ($roles === []) {
            return [];
        }

        return array_values(User::query()
            ->whereIn('role', $roles)
            ->where('locked_until', '>', now())
            ->orderBy('locked_until')
            ->get()
            ->map(fn (User $owner): array => [
                'id' => $owner->id,
                'name' => $owner->name,
                'email' => $owner->email,
                'role_label' => $owner->role->label(),
                'locked_until' => (string) $owner->locked_until?->toIso8601String(),
                'locks_today' => self::locksToday($owner),
            ])
            ->all());
    }

    /**
     * How many times the account was locked today.
     */
    public static function locksToday(User $user): int
    {
        return AccountLock::query()->where('user_id', $user->id)->where('created_at', '>=', today())->count();
    }

    /** "This account is locked after 5 wrong passwords in a row. Try again at 2:45 PM." */
    public static function lockedMessage(CarbonInterface $lockedUntil): string
    {
        return 'This account is locked after '.self::MAX_WRONG_PASSWORDS.' wrong passwords in a row. Try again at '.self::timeText($lockedUntil).'.';
    }

    /** "2:45 PM" today, else "Nov 16, 2026, 2:45 PM". */
    public static function timeText(CarbonInterface $at): string
    {
        return $at->isToday() ? $at->format('g:i A') : $at->format('M j, Y, g:i A');
    }

    /**
     * Who is told of the lock and may unlock it: the Specialist for a
     * buyer, the School Admin for the Specialist.
     *
     * @return list<User>
     */
    private static function unlockers(User $owner): array
    {
        $role = match (true) {
            $owner->isBuyer() => UserRole::Specialist,
            $owner->isSpecialist() => UserRole::SchoolAdmin,
            default => null,
        };

        return $role === null ? [] : array_values(User::query()->where('role', $role)->get()->all());
    }
}
