<?php

namespace App\Notifications;

use App\Models\User;
use App\Notifications\Channels\PushChannel;
use App\Notifications\Channels\PushesToPhones;
use App\Services\Auth\SignInLock;
use Carbon\CarbonInterface;
use Illuminate\Notifications\Notification;

/**
 * Tells the Specialist a buyer's account was locked (or the School Admin
 * that the Specialist's or the cashier's was), so they can unlock it once they are sure it
 * is the owner asking. A third lock in a day is called out: someone may be
 * guessing the password. Also pushed to their phones.
 */
class AccountLockedForStaff extends Notification implements PushesToPhones
{
    public function __construct(public User $owner, public CarbonInterface $lockedUntil, public int $locksToday) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', PushChannel::class];
    }

    /**
     * @return array{kind: string, user_id: int, name: string, email: string, locked_until: string, locks_today: int}
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'account_locked_staff',
            'user_id' => $this->owner->id,
            'name' => $this->owner->name,
            'email' => $this->owner->email,
            'locked_until' => $this->lockedUntil->toIso8601String(),
            'locks_today' => $this->locksToday,
        ];
    }

    /**
     * @return array{title: string, body: string, data: array<string, scalar|null>}
     */
    public function toPush(object $notifiable): array
    {
        return [
            'title' => "Account locked: {$this->owner->name}",
            'body' => self::body($this->lockedUntil, $this->locksToday),
            'data' => ['kind' => 'account_locked_staff', 'user_id' => $this->owner->id],
        ];
    }

    /**
     * "5 wrong passwords in a row. Locked until 2:45 PM." and, from the
     * third lock of the day, "Locked 3 times today: someone may be guessing
     * the password."
     */
    public static function body(CarbonInterface $lockedUntil, int $locksToday): string
    {
        $body = SignInLock::MAX_WRONG_PASSWORDS.' wrong passwords in a row. Locked until '.SignInLock::timeText($lockedUntil).'.';

        return $locksToday >= SignInLock::WARN_AFTER_LOCKS
            ? "{$body} Locked {$locksToday} times today: someone may be guessing the password."
            : $body;
    }
}
