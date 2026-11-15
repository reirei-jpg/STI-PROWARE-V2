<?php

namespace App\Services\Auth;

use App\Models\User;
use Carbon\CarbonInterface;

/**
 * Locks an account after 5 wrong passwords in a row, for 15 minutes, on the
 * website and the phone app alike. Unlike the per-minute limit on sign-in
 * requests, the count belongs to the account, so waiting a minute or trying
 * from another phone does not get around it. A correct sign-in starts the
 * count again; the lock ends by itself.
 */
class SignInLock
{
    public const MAX_WRONG_PASSWORDS = 5;

    public const LOCK_MINUTES = 15;

    /**
     * Why this account cannot sign in right now (even with the right
     * password), or null when it can.
     */
    public static function refusal(User $user): ?string
    {
        // Over at the time the message gives ("Try again at 2:45 PM").
        if ($user->locked_until === null || ! $user->locked_until->isFuture()) {
            return null;
        }

        return self::lockedMessage($user->locked_until);
    }

    /**
     * Counts a wrong password. The 5th in a row locks the account and signs
     * it out of every phone; then the lock's message is returned, otherwise
     * null.
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
        $user->tokens()->delete();

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

    /** "This account is locked after 5 wrong passwords in a row. Try again at 2:45 PM." */
    public static function lockedMessage(CarbonInterface $lockedUntil): string
    {
        $time = $lockedUntil->isToday() ? $lockedUntil->format('g:i A') : $lockedUntil->format('M j, Y, g:i A');

        return 'This account is locked after '.self::MAX_WRONG_PASSWORDS." wrong passwords in a row. Try again at {$time}.";
    }
}
