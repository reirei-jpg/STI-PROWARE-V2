<?php

namespace App\Notifications;

use App\Notifications\Channels\PushChannel;
use App\Notifications\Channels\PushesToPhones;
use Illuminate\Notifications\Notification;

/**
 * Tells a student whose ordering was paused (orders kept expiring) that the
 * Specialist lifted the pause, so they can order again now. Also pushed to
 * their phones.
 */
class OrderingResumed extends Notification implements PushesToPhones
{
    public const TITLE = 'You can order again';

    public const BODY = 'The PROWARE office lifted your ordering pause. You can place orders now.';

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', PushChannel::class];
    }

    /**
     * @return array{kind: string}
     */
    public function toArray(object $notifiable): array
    {
        return ['kind' => 'ordering_resumed'];
    }

    /**
     * @return array{title: string, body: string, data: array<string, scalar|null>}
     */
    public function toPush(object $notifiable): array
    {
        return [
            'title' => self::TITLE,
            'body' => self::BODY,
            'data' => ['kind' => 'ordering_resumed'],
        ];
    }
}
