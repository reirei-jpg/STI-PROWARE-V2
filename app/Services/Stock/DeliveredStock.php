<?php

namespace App\Services\Stock;

use App\Enums\StockMovementType;
use App\Models\DeliveryItem;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Adds delivered items to stock. An item is added once its eStore Item Code
 * is linked to a product variant: when the delivery is recorded, or later
 * when the Specialist links the code (then every earlier delivery of it is
 * added). Head Office's quantity becomes pieces through the pack the item
 * comes in, e.g. 2 × Pack (50 pieces) = 100 pieces.
 *
 * Each delivered item is added at most once; the stock movements table
 * refuses a second movement for the same delivered item.
 */
final class DeliveredStock
{
    public function __construct(private LowStockAlerts $lowStockAlerts) {}

    /**
     * Add the delivered items whose eStore Item Code is linked to a variant.
     * Items already in stock, and items not linked yet, are skipped.
     *
     * @param  Collection<int, DeliveryItem>  $deliveryItems
     * @return int pieces added to stock
     */
    public function add(Collection $deliveryItems, ?User $recordedBy): int
    {
        if ($deliveryItems->isEmpty()) {
            return 0;
        }

        return DB::transaction(function () use ($deliveryItems, $recordedBy): int {
            $waiting = DeliveryItem::query()
                ->with('purchaseOrderItem')
                ->whereKey($deliveryItems->modelKeys())
                ->whereDoesntHave('stockMovement')
                ->orderBy('id')
                ->get();

            // Lock the variants so two deliveries saved at once cannot both
            // start from the same balance.
            $variants = ProductVariant::query()
                ->with('estorePack')
                ->whereIn('estore_item_code', $waiting->map(fn (DeliveryItem $item): string => $item->purchaseOrderItem->item_code)->unique()->values())
                ->lockForUpdate()
                ->get()
                ->keyBy('estore_item_code');

            $piecesAdded = 0;

            foreach ($waiting as $item) {
                /** @var ProductVariant|null $variant */
                $variant = $variants->get($item->purchaseOrderItem->item_code);

                if ($variant === null) {
                    continue;
                }

                $piecesPerUnit = $variant->estorePack->pieces ?? 1;
                $pieces = $item->quantity_received * $piecesPerUnit;
                $balance = $variant->stock_on_hand + $pieces;

                $variant->forceFill(['stock_on_hand' => $balance])->save();

                $variant->stockMovements()->create([
                    'type' => StockMovementType::Delivery,
                    'quantity' => $pieces,
                    'balance_after' => $balance,
                    'delivery_item_id' => $item->id,
                    'units_received' => $item->quantity_received,
                    'unit_name' => $variant->estorePack->name ?? 'Piece',
                    'pieces_per_unit' => $piecesPerUnit,
                    'recorded_by' => $recordedBy?->id,
                ]);

                $piecesAdded += $pieces;
            }

            // Stock went up, so a variant warned before may be warned again.
            foreach ($variants as $variant) {
                $this->lowStockAlerts->check($variant);
            }

            return $piecesAdded;
        });
    }

    /**
     * Add every delivered item of the variant's eStore Item Code that is not
     * in stock yet, e.g. right after the Specialist links the code.
     *
     * @return int pieces added to stock
     */
    public function addWaitingFor(ProductVariant $variant, ?User $recordedBy): int
    {
        if ($variant->estore_item_code === null) {
            return 0;
        }

        return $this->add(
            DeliveryItem::query()
                ->whereHas('purchaseOrderItem', fn (Builder $query) => $query->where('item_code', $variant->estore_item_code))
                ->whereDoesntHave('stockMovement')
                ->get(),
            $recordedBy,
        );
    }
}
