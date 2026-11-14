<?php

namespace App\Services;

use App\Models\Order;
use Illuminate\Notifications\DatabaseNotification;

/**
 * A notification as the website's bell and the phone app show it. The data
 * is whatever the notification stored (see OrderReleased, PurchaseOrderUploaded
 * and the others), decoded from the database.
 */
final class NotificationRow
{
    /**
     * The buyer's order notices: they name the items, never the PW- number.
     */
    private const array ORDER_KINDS = ['order_ready', 'order_released', 'order_last_day', 'order_cancelled'];

    /**
     * @return array{id: string, data: array<mixed>, read: bool, created_at: string|null}
     */
    public static function of(DatabaseNotification $notification): array
    {
        return [
            'id' => $notification->id,
            'data' => self::withItems($notification->data),
            'read' => $notification->read_at !== null,
            'created_at' => $notification->created_at?->toIso8601String(),
        ];
    }

    /**
     * Order notices sent before they stored the item names get them here.
     *
     * @param  array<mixed>  $data
     * @return array<mixed>
     */
    private static function withItems(array $data): array
    {
        if (! in_array($data['kind'] ?? null, self::ORDER_KINDS, true) || isset($data['items'])) {
            return $data;
        }

        $order = is_int($data['order_id'] ?? null) ? Order::query()->whereKey($data['order_id'])->first() : null;

        return [...$data, 'items' => $order?->itemsText() ?? 'your order'];
    }
}
