<?php

namespace App\Notifications;

use App\Notifications\Channels\PushChannel;
use App\Notifications\Channels\PushesToPhones;
use App\Services\Auth\SignInLock;
use Carbon\CarbonInterface;
use Illuminate\Notifications\Notification;

/**
 * Tells the account's owner it was locked after 5 wrong passwords in a row,
 * so they know if someone else tried. Also pushed to their phones.
 */
class AccountLocked extends Notification implements PushesToPhones
{
    public function __construct(public CarbonInterface $lockedUntil) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', PushChannel::class];
    }

    /**
     * @return array{kind: string, locked_until: string}
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'account_locked',
            'locked_until' => $this->lockedUntil->toIso8601String(),
        ];
    }

    /**
     * @return array{title: string, body: string, data: array<string, scalar|null>}
     */
    public function toPush(object $notifiable): array
    {
        return [
            'title' => 'Your account was locked',
            'body' => self::body($this->lockedUntil),
            'data' => ['kind' => 'account_locked'],
        ];
    }

    /**
     * "5 wrong passwords were typed for your account, so it is locked until
     * 2:45 PM and signed out everywhere. If this was not you, change your
     * password."
     */
    public static function body(CarbonInterface $lockedUntil): string
    {
        return SignInLock::MAX_WRONG_PASSWORDS.' wrong passwords were typed for your account, so it is locked until '.SignInLock::timeText($lockedUntil).' and signed out everywhere. If this was not you, change your password.';
    }
}
