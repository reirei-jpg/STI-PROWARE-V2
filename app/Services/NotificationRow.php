<?php

namespace App\Services;

use Illuminate\Notifications\DatabaseNotification;

/**
 * A notification as the website's bell and the phone app show it. The data
 * is whatever the notification stored (see OrderReady, PurchaseOrderUploaded
 * and the others), decoded from the database.
 */
final class NotificationRow
{
    /**
     * @return array{id: string, data: array<mixed>, read: bool, created_at: string|null}
     */
    public static function of(DatabaseNotification $notification): array
    {
        return [
            'id' => $notification->id,
            'data' => $notification->data,
            'read' => $notification->read_at !== null,
            'created_at' => $notification->created_at?->toIso8601String(),
        ];
    }
}
