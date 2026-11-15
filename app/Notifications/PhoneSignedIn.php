<?php

namespace App\Notifications;

use App\Notifications\Channels\PushChannel;
use App\Notifications\Channels\PushesToPhones;
use Carbon\CarbonInterface;
use Illuminate\Notifications\Notification;

/**
 * Tells the account's owner it was signed in on a phone (the app), so a
 * sign-in that was not them is noticed. Pushed to the phones already
 * signed in, not the new one.
 */
class PhoneSignedIn extends Notification implements PushesToPhones
{
    public function __construct(public string $deviceName, public CarbonInterface $signedInAt) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', PushChannel::class];
    }

    /**
     * @return array{kind: string, device_name: string, signed_in_at: string}
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'phone_signed_in',
            'device_name' => $this->deviceName,
            'signed_in_at' => $this->signedInAt->toIso8601String(),
        ];
    }

    /**
     * @return array{title: string, body: string, data: array<string, scalar|null>}
     */
    public function toPush(object $notifiable): array
    {
        return [
            'title' => 'New sign-in on a phone',
            'body' => self::body($this->signedInAt),
            'data' => ['kind' => 'phone_signed_in'],
        ];
    }

    /**
     * "Your account was signed in on a phone on Nov 15, 2:30 PM.
     * If this was not you, change your password."
     */
    public static function body(CarbonInterface $signedInAt): string
    {
        return "Your account was signed in on a phone on {$signedInAt->format('M j, g:i A')}. If this was not you, change your password.";
    }
}
