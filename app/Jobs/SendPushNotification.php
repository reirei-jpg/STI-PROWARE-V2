<?php

namespace App\Jobs;

use App\Enums\PushResult;
use App\Models\DeviceToken;
use App\Services\FcmClient;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Pushes one notice to every phone the student signed in on.
 *
 * Best effort by design: the notice is already in the app's Notifications,
 * so a failed push is dropped rather than retried into duplicates. A phone
 * whose token is dead (app uninstalled) is forgotten.
 */
class SendPushNotification implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    /**
     * @param  array<string, scalar|null>  $data  what the app opens when it is tapped
     */
    public function __construct(
        public int $userId,
        public string $title,
        public string $body,
        public array $data = [],
    ) {}

    public function handle(FcmClient $fcm): void
    {
        if (! $fcm->isConfigured()) {
            return;
        }

        DeviceToken::query()
            ->where('user_id', $this->userId)
            ->get()
            ->each(function (DeviceToken $device) use ($fcm): void {
                if ($fcm->send($device->token, $this->title, $this->body, $this->data) === PushResult::InvalidToken) {
                    $device->delete();
                }
            });
    }
}
