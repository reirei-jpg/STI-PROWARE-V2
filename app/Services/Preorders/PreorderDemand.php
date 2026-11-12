<?php

namespace App\Services\Preorders;

use App\Enums\DeliveryStatus;
use App\Enums\PreorderStatus;
use App\Models\Preorder;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Services\Stock\LinkedItems;

/**
 * How much of an eStore PO was ordered because of buyers' preorders, and how
 * much is the Specialist's own order. When a PO is saved, each item's
 * preorder demand is the pieces buyers are still waiting for in preorders of
 * its products (Coming Soon or a sold-out size), less what earlier POs still
 * on their way already cover, at most what the item orders. It is kept with
 * the item, in the PO's own units, so it does not change later.
 */
final class PreorderDemand
{
    public static function record(PurchaseOrder $purchaseOrder): void
    {
        $items = $purchaseOrder->items()->get();
        $variantsByCode = LinkedItems::variantsByCode($items->pluck('item_code')->all());

        foreach ($items as $item) {
            $variants = $variantsByCode->get($item->item_code);

            if ($variants === null || $variants->isEmpty()) {
                $item->forceFill(['preorder_quantity' => 0])->save();

                continue;
            }

            $piecesPerUnit = max(1, (int) $variants->first()->stockTarget()['pieces_per_unit']);
            $waiting = (int) Preorder::query()
                ->whereIn('product_variant_id', $variants->modelKeys())
                ->where('status', PreorderStatus::Active)
                ->sum('quantity');
            $covered = self::coveredByOtherOrders($item, $piecesPerUnit);
            $demandPieces = max(0, $waiting - $covered);

            $item->forceFill([
                'preorder_quantity' => min($item->quantity_ordered, intdiv($demandPieces + $piecesPerUnit - 1, $piecesPerUnit)),
            ])->save();
        }
    }

    /**
     * Preordered pieces already ordered on other POs of the same item that
     * have not fully arrived (the arrived ones already served their buyers).
     */
    private static function coveredByOtherOrders(PurchaseOrderItem $item, int $piecesPerUnit): int
    {
        return (int) PurchaseOrderItem::query()
            ->where('item_code', $item->item_code)
            ->whereKeyNot($item->id)
            ->whereNotNull('preorder_quantity')
            ->whereHas('purchaseOrder', fn ($orders) => $orders->whereIn('delivery_status', [DeliveryStatus::Awaiting, DeliveryStatus::PartiallyReceived]))
            ->get()
            ->sum(fn (PurchaseOrderItem $other): int => max(0, (int) $other->preorder_quantity - $other->quantity_delivered) * $piecesPerUnit);
    }
}
