<?php

namespace App\Notifications\Channels;

use App\Jobs\SendPushNotification;
use App\Models\User;
use Illuminate\Notifications\Notification;

/**
 * Sends a notification to the student's phones in the background, after
 * the database has saved everything, so a slow or failed push never holds
 * up or undoes what the Specialist did.
 */
class PushChannel
{
    public function send(object $notifiable, Notification $notification): void
    {
        if (! $notifiable instanceof User || ! $notification instanceof PushesToPhones) {
            return;
        }

        $push = $notification->toPush($notifiable);

        SendPushNotification::dispatch($notifiable->id, $push['title'], $push['body'], $push['data'])->afterCommit();
    }
}
