<?php

namespace App\Services\Deliveries;

use App\Enums\DeliveryStatus;
use App\Models\PurchaseOrder;
use App\Services\Settings\SystemSettings;
use Illuminate\Database\Eloquent\Builder;

/**
 * Purchase orders to follow up with Head Office: not complete after a
 * number of days from their Date Ordered (a Maintenance setting, 30 by
 * default). Head Office gives no delivery date, so the Date Ordered on the
 * eStore PO is what the system knows.
 */
final class FollowUp
{
    /** Days after the Date Ordered an order should be complete (Maintenance). */
    public static function days(): int
    {
        return SystemSettings::integer(SystemSettings::DELIVERY_FOLLOW_UP_DAYS);
    }

    /**
     * Purchase orders not fully delivered yet.
     *
     * @return Builder<PurchaseOrder>
     */
    public static function openOrders(): Builder
    {
        return PurchaseOrder::query()->whereIn('delivery_status', [DeliveryStatus::Awaiting, DeliveryStatus::PartiallyReceived]);
    }

    /**
     * Open orders dated the setting's days ago or earlier, e.g. with 30
     * days an order dated Sep 29 shows from Oct 29.
     *
     * @return Builder<PurchaseOrder>
     */
    public static function dueOrders(): Builder
    {
        return self::openOrders()->whereDate('date_ordered', '<=', now()->subDays(self::days())->toDateString());
    }

    /** Whole days since the order was dated, e.g. 32. */
    public static function daysSinceOrdered(PurchaseOrder $order): int
    {
        return (int) $order->date_ordered->copy()->startOfDay()->diffInDays(now()->startOfDay());
    }
}
