<?php

namespace App\Services\Stock;

use App\Enums\ProductStatus;
use App\Enums\StockMovementType;
use App\Models\DeliveryItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\Storefront\StorefrontFeed;
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
 * Each Item Code is one size or color, so a delivered item goes into that
 * one variant. Each delivered item is added at most once; the stock
 * movements table refuses a second one. Students waiting for a sold-out
 * size that arrived are notified, and a product that was sold out is NEW
 * for 3 days.
 */
final class DeliveredStock
{
    public function __construct(
        private LowStockAlerts $lowStockAlerts,
        private RestockedPreorders $restockedPreorders,
    ) {}

    /**
     * Add the delivered items whose Item Code is linked. Items already in
     * stock and items not linked yet are skipped.
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
                ->whereDoesntHave('stockMovements')
                ->orderBy('id')
                ->get();

            // Lock the variants so two deliveries saved at once cannot both
            // start from the same balance.
            $variantsByCode = LinkedItems::variantsByCode(
                $waiting->map(fn (DeliveryItem $item): string => $item->purchaseOrderItem->item_code)->all(),
                lockForUpdate: true,
            );
            $soldOutBefore = self::soldOutProductIds(
                $variantsByCode->flatten(1)->map(fn (ProductVariant $variant): int => $variant->product_id)->unique()->values()->all(),
            );

            $piecesAdded = 0;
            $restockedIds = [];

            foreach ($waiting as $item) {
                $variant = $variantsByCode->get($item->purchaseOrderItem->item_code)?->first();

                if ($variant === null) {
                    continue;
                }

                $piecesPerUnit = $variant->estorePack->pieces ?? 1;
                $piecesAdded += $this->addToVariant($variant, $item, $item->quantity_received, $variant->estorePack->name ?? 'Piece', $piecesPerUnit, $piecesPerUnit, $recordedBy);
                $restockedIds[] = $variant->id;
            }

            // A product that was sold out and got stock again is NEW (Coming
            // Soon products are handled when they arrive).
            $restockedProductIds = $variantsByCode->flatten(1)->whereIn('id', $restockedIds)->pluck('product_id')->unique()->all();
            Product::query()
                ->whereKey(array_intersect($soldOutBefore, $restockedProductIds))
                ->whereIn('status', [ProductStatus::Available, ProductStatus::OnSale])
                ->update(['new_until' => now()->addDays(StorefrontFeed::NEW_DAYS)]);

            // Waiting preorders are served first: a Coming Soon product becomes
            // Available there, and held pieces are no longer free to sell. The
            // low-stock check then sees the product as it is now (stock went up,
            // so a variant warned before may be warned again).
            foreach ($variantsByCode->flatten(1) as $variant) {
                $this->restockedPreorders->check($variant);
                $variant->unsetRelation('product');
                $this->lowStockAlerts->check($variant, restocked: in_array($variant->id, $restockedIds, true));
            }

            return $piecesAdded;
        });
    }

    /**
     * Add every delivered item of the variant's Item Code that is not in
     * stock yet, e.g. right after the Specialist links the code.
     *
     * @return int pieces added to stock
     */
    public function addWaitingFor(ProductVariant $variant, ?User $recordedBy): int
    {
        if ($variant->estore_item_code === null) {
            return 0;
        }

        return $this->add($this->waitingItems($variant->estore_item_code), $recordedBy);
    }

    /**
     * The given products with nothing students can buy (every variant sold
     * out).
     *
     * @param  array<int, int>  $productIds
     * @return array<int, int>
     */
    private static function soldOutProductIds(array $productIds): array
    {
        return Product::query()
            ->whereKey($productIds)
            ->whereDoesntHave('variants', fn (Builder $variants) => $variants->whereRaw(ProductVariant::FREE_TO_SELL_SQL.' > 0'))
            ->get(['id'])
            ->map(fn (Product $product): int => $product->id)
            ->all();
    }

    /**
     * @return Collection<int, DeliveryItem>
     */
    private function waitingItems(string $itemCode): Collection
    {
        return DeliveryItem::query()
            ->whereHas('purchaseOrderItem', fn (Builder $query) => $query->where('item_code', $itemCode))
            ->whereDoesntHave('stockMovements')
            ->orderBy('id')
            ->get();
    }

    /**
     * Add the pieces with their eStore cost (the purchase order line's unit
     * price per eStore unit of $estoreUnitPieces pieces).
     */
    private function addToVariant(ProductVariant $variant, DeliveryItem $item, int $units, string $unitName, int $piecesPerUnit, int $estoreUnitPieces, ?User $recordedBy): int
    {
        $pieces = $units * $piecesPerUnit;
        $balance = $variant->stock_on_hand + $pieces;

        $variant->forceFill(['stock_on_hand' => $balance])->save();

        $variant->stockMovements()->create([
            'type' => StockMovementType::Delivery,
            'quantity' => $pieces,
            'balance_after' => $balance,
            'delivery_item_id' => $item->id,
            'units_received' => $units,
            'unit_name' => $unitName,
            'pieces_per_unit' => $piecesPerUnit,
            'cost_centavos' => StockCost::ofDelivery($item, $pieces, $estoreUnitPieces),
            'recorded_by' => $recordedBy?->id,
        ]);

        // A delivery recorded late may cost sales made before it.
        StockCost::replay($variant->id);

        return $pieces;
    }
}
