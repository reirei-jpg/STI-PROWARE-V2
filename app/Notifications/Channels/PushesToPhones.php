<?php

namespace App\Notifications\Channels;

/**
 * A notification that is also pushed to the student's phones: the same
 * words as the website's bell, and what the app opens when it is tapped.
 */
interface PushesToPhones
{
    /**
     * @return array{title: string, body: string, data: array<string, scalar|null>}
     */
    public function toPush(object $notifiable): array;
}
