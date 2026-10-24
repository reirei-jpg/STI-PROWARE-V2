<?php

namespace App\Services\Deliveries;

use App\Enums\DeliveryStatus;
use App\Models\PurchaseOrder;
use App\Models\Setting;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;

/**
 * Purchase orders to follow up with Head Office: not complete after a
 * number of days from their Date Ordered (the Specialist's setting, 30 by
 * default). Head Office gives no delivery date, so the Date Ordered on the
 * eStore PO is what the system knows. The School Admin may remind the
 * Specialist about such a late order once a week.
 */
final class FollowUp
{
    public const DEFAULT_DAYS = 30;

    /** The choices on the Maintenance page. */
    public const CHOICES = [14, 21, 30, 45, 60];

    /** Days the School Admin waits before reminding the Specialist again. */
    public const REMIND_AGAIN_AFTER_DAYS = 7;

    /** Days after the Date Ordered an order should be complete. */
    public static function days(): int
    {
        $days = Setting::integer(Setting::DELIVERY_FOLLOW_UP_DAYS, self::DEFAULT_DAYS);

        return in_array($days, self::CHOICES, true) ? $days : self::DEFAULT_DAYS;
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

    /** Still open and not complete after the follow-up days. */
    public static function isLate(PurchaseOrder $order): bool
    {
        return $order->delivery_status->isOpen() && self::daysSinceOrdered($order) >= self::days();
    }

    /** The day the School Admin may remind the Specialist again, or null if they may now. */
    public static function remindAgainOn(PurchaseOrder $order): ?CarbonInterface
    {
        $again = $order->specialist_reminded_at?->copy()->startOfDay()->addDays(self::REMIND_AGAIN_AFTER_DAYS);

        return $again !== null && $again->isFuture() ? $again : null;
    }

    /** A late order not reminded about in the last week. */
    public static function canRemind(PurchaseOrder $order): bool
    {
        return self::isLate($order) && self::remindAgainOn($order) === null;
    }
}
