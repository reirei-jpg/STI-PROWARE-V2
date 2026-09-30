<?php

namespace App\Services\Deliveries;

use App\Enums\DeliveryStatus;
use App\Enums\UserRole;
use App\Models\PurchaseOrder;
use App\Models\User;
use App\Notifications\ExpectedDeliveryReminder;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Notification;

/**
 * Sends the Specialist's delivery reminders: the day before and on the day
 * of an order's expected delivery date, from 7:00 AM (Philippine time).
 * Each reminder is sent once per date; changing the date allows new ones.
 */
class DeliveryReminders
{
    public const SEND_FROM_HOUR = 7;

    /**
     * Send every reminder that is due now, for all orders or just one.
     *
     * @return int how many reminders were sent
     */
    public function sendDue(?PurchaseOrder $only = null): int
    {
        $now = now();

        if ($now->hour < self::SEND_FROM_HOUR) {
            return 0;
        }

        $specialists = User::query()->where('role', UserRole::Specialist)->get();
        $sent = 0;

        $due = fn (string $date, string $sentColumn) => PurchaseOrder::query()
            ->when($only, fn (Builder $query, PurchaseOrder $order) => $query->whereKey($order->getKey()))
            ->whereIn('delivery_status', [DeliveryStatus::Awaiting, DeliveryStatus::PartiallyReceived])
            ->whereDate('expected_delivery_date', $date)
            ->whereNull($sentColumn)
            ->get();

        foreach ($due($now->copy()->addDay()->toDateString(), 'day_before_reminder_sent_at') as $order) {
            Notification::send($specialists, new ExpectedDeliveryReminder($order, 'tomorrow'));
            $order->forceFill(['day_before_reminder_sent_at' => $now])->save();
            $sent++;
        }

        foreach ($due($now->toDateString(), 'day_of_reminder_sent_at') as $order) {
            Notification::send($specialists, new ExpectedDeliveryReminder($order, 'today'));
            $order->forceFill(['day_of_reminder_sent_at' => $now])->save();
            $sent++;
        }

        return $sent;
    }
}
