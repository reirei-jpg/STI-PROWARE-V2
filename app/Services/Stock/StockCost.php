<?php

namespace App\Services\Stock;

use App\Enums\StockMovementType;
use App\Models\DeliveryItem;
use App\Models\OrderItem;
use App\Models\ProductVariant;
use App\Models\StockMovement;

/**
 * What PROWARE paid for its stock, as on the uploaded eStore purchase
 * orders, and so what each sale cost. Pieces come in with their eStore
 * price (a delivery: the order line's unit price; a recount that adds
 * pieces: the price the Specialist enters) and leave oldest first: a sale
 * takes the price of the oldest pieces still on the shelf. Pieces put back
 * (a release undone) come back with the price they left with.
 *
 * The whole history of a variant is replayed after each change, so a late
 * delivery or a price entered afterwards fixes earlier sales too.
 */
final class StockCost
{
    /** Movements that put back pieces that left before. */
    private const RETURNS = [StockMovementType::ReleaseUndone, StockMovementType::OrderCancelled, StockMovementType::ConvertedToHeld];

    /**
     * The eStore cost of delivered pieces: the order line's unit price per
     * eStore unit (e.g. ₱900 per Pack of 50), for this many pieces.
     */
    public static function ofDelivery(DeliveryItem $item, int $pieces, int $estoreUnitPieces): int
    {
        return (int) round($item->purchaseOrderItem->unit_price_centavos * $pieces / max(1, $estoreUnitPieces));
    }

    /**
     * Replay the variant's stock history, oldest first, and save what each
     * sale cost on its stock movement and order item, and how many pieces
     * in stock now have no eStore price.
     */
    public static function replay(int $variantId): void
    {
        $variant = ProductVariant::query()->find($variantId);

        if ($variant === null) {
            return;
        }

        $movements = StockMovement::query()->where('product_variant_id', $variantId)->orderBy('id')->get();
        $first = $movements->first();

        // Stock that was there before the first recorded movement.
        $opening = $first === null ? $variant->stock_on_hand : $first->balance_after - $first->quantity;

        /** @var list<array{pieces: int, cost: float|null}> $layers oldest first */
        $layers = $opening > 0
            ? [['pieces' => $opening, 'cost' => $variant->opening_unit_cost_centavos === null ? null : (float) ($variant->opening_unit_cost_centavos * $opening)]]
            : [];

        /** @var array<int, array{cost: int|null, pieces: int}> $soldItems the latest sale of each order item */
        $soldItems = [];

        foreach ($movements as $movement) {
            if ($movement->quantity > 0) {
                if (in_array($movement->type, self::RETURNS, true)) {
                    $sold = $movement->order_item_id === null ? null : ($soldItems[$movement->order_item_id] ?? null);
                    $cost = $sold === null || $sold['cost'] === null || $sold['pieces'] === 0 ? null : $sold['cost'] * $movement->quantity / $sold['pieces'];
                    array_unshift($layers, ['pieces' => $movement->quantity, 'cost' => $cost]);
                } else {
                    $layers[] = ['pieces' => $movement->quantity, 'cost' => $movement->cost_centavos === null ? null : (float) $movement->cost_centavos];
                }

                continue;
            }

            // Every piece that leaves (sold, given free, damaged...) keeps its cost.
            $rounded = ($cost = self::take($layers, -$movement->quantity)) === null ? null : (int) round($cost);

            if ($movement->cost_centavos !== $rounded) {
                $movement->forceFill(['cost_centavos' => $rounded])->saveQuietly();
            }

            if ($movement->type === StockMovementType::Sale && $movement->order_item_id !== null) {
                $soldItems[$movement->order_item_id] = ['cost' => $rounded, 'pieces' => -$movement->quantity];
            }
        }

        foreach ($soldItems as $orderItemId => $sold) {
            OrderItem::query()->whereKey($orderItemId)->update(['cost_centavos' => $sold['cost']]);
        }

        $uncosted = array_sum(array_map(fn (array $layer): int => $layer['cost'] === null ? $layer['pieces'] : 0, $layers));

        if ($variant->uncosted_pieces !== $uncosted) {
            $variant->forceFill(['uncosted_pieces' => $uncosted])->saveQuietly();
        }
    }

    /**
     * The Specialist enters the eStore price per piece of stock that came
     * in without one (stock from before deliveries were recorded, or a
     * recount that added pieces); then every sale of it is costed again.
     */
    public static function setMissingPrice(ProductVariant $variant, int $centavosPerPiece): void
    {
        if ($variant->opening_unit_cost_centavos === null) {
            $variant->forceFill(['opening_unit_cost_centavos' => $centavosPerPiece])->save();
        }

        $variant->stockMovements()
            ->where('type', StockMovementType::Correction)
            ->where('quantity', '>', 0)
            ->whereNull('cost_centavos')
            ->get()
            ->each(fn (StockMovement $movement) => $movement->forceFill(['cost_centavos' => $centavosPerPiece * $movement->quantity])->save());

        self::replay($variant->id);
    }

    /**
     * Cost every delivery already recorded from its purchase order, then
     * every sale. Used once when costs started being kept.
     */
    public static function backfill(): void
    {
        StockMovement::query()
            ->where('type', StockMovementType::Delivery)
            ->whereNull('cost_centavos')
            ->whereNotNull('delivery_item_id')
            ->with('deliveryItem.purchaseOrderItem')
            ->each(function (StockMovement $movement): void {
                $item = $movement->deliveryItem;

                if ($item === null) {
                    return;
                }

                // A shared code split by the piece still came in eStore units.
                $estoreUnitPieces = $movement->unit_name !== null && $movement->unit_name !== 'Piece'
                    ? (int) $movement->pieces_per_unit
                    : DeliveredStock::piecesPerUnit($item->purchaseOrderItem->item_code);

                $movement->forceFill(['cost_centavos' => self::ofDelivery($item, $movement->quantity, $estoreUnitPieces)])->saveQuietly();
            });

        ProductVariant::query()->select('id')->each(fn (ProductVariant $variant) => self::replay($variant->id));
    }

    /**
     * Take pieces off the oldest layers. The cost of what was taken; null
     * when part of it has no eStore price (or there was not enough stock on
     * record).
     *
     * @param  list<array{pieces: int, cost: float|null}>  $layers
     */
    private static function take(array &$layers, int $pieces): ?float
    {
        $cost = 0.0;
        $known = true;

        while ($pieces > 0) {
            if ($layers === []) {
                return null;
            }

            $taken = min($pieces, $layers[0]['pieces']);

            if ($layers[0]['cost'] === null) {
                $known = false;
            } else {
                $share = $layers[0]['cost'] * $taken / $layers[0]['pieces'];
                $cost += $share;
                $layers[0]['cost'] -= $share;
            }

            $layers[0]['pieces'] -= $taken;
            $pieces -= $taken;

            if ($layers[0]['pieces'] === 0) {
                array_shift($layers);
            }
        }

        return $known ? $cost : null;
    }
}
