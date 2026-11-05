<?php

namespace App\Services\Storefront;

use App\Enums\DeliveryStatus;
use App\Models\PurchaseOrderItem;
use Illuminate\Database\Eloquent\Builder;

/**
 * "Available soon": a sold-out product or size whose eStore Item Code is on
 * an uploaded eStore order that still has pieces to arrive (Awaiting
 * Delivery or Partially Received). A brand-new code counts once it is
 * linked to the product, since only then PROWARE knows what is coming.
 */
final class AvailableSoon
{
    /**
     * The given item codes that still have pieces coming.
     *
     * @param  array<int, string|null>  $itemCodes
     * @return array<int, string>
     */
    public static function coming(array $itemCodes): array
    {
        $codes = array_values(array_unique(array_filter($itemCodes)));

        if ($codes === []) {
            return [];
        }

        return PurchaseOrderItem::query()
            ->whereIn('item_code', $codes)
            ->whereColumn('quantity_delivered', '<', 'quantity_ordered')
            ->whereHas('purchaseOrder', fn (Builder $orders) => $orders->whereIn('delivery_status', [DeliveryStatus::Awaiting, DeliveryStatus::PartiallyReceived]))
            ->get(['item_code'])
            ->map(fn (PurchaseOrderItem $item): string => $item->item_code)
            ->unique()
            ->values()
            ->all();
    }
}
