<?php

namespace App\Services\Stock;

use App\Enums\StockMovementType;
use App\Models\DeliveryItem;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Adds delivered items to stock. An item is added once its eStore Item Code
 * is linked to a product variant: when the delivery is recorded, or later
 * when the Specialist links the code (then every earlier delivery of it is
 * added). Head Office's quantity becomes pieces through the pack the item
 * comes in, e.g. 2 × Pack (50 pieces) = 100 pieces.
 *
 * When several variants share the code (e.g. an umbrella in every color),
 * the Specialist says how many pieces of each variant arrived, and each
 * variant gets its own stock movement. Until then the item waits.
 *
 * Each delivered item is added at most once per variant; the stock
 * movements table refuses a second one.
 */
final class DeliveredStock
{
    public function __construct(private LowStockAlerts $lowStockAlerts) {}

    /**
     * Add the delivered items whose eStore Item Code is linked. Items already
     * in stock, items not linked yet, and items of a shared code without a
     * split are skipped.
     *
     * @param  Collection<int, DeliveryItem>  $deliveryItems
     * @param  array<int, array<int, int>>  $splits  pieces by variant id, by delivery item id (shared codes only)
     * @return int pieces added to stock
     */
    public function add(Collection $deliveryItems, ?User $recordedBy, array $splits = []): int
    {
        if ($deliveryItems->isEmpty()) {
            return 0;
        }

        return DB::transaction(function () use ($deliveryItems, $recordedBy, $splits): int {
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

            $piecesAdded = 0;

            foreach ($waiting as $item) {
                $variants = $variantsByCode->get($item->purchaseOrderItem->item_code);

                if ($variants === null) {
                    continue;
                }

                if ($variants->count() === 1) {
                    /** @var ProductVariant $variant */
                    $variant = $variants->first();
                    $piecesPerUnit = $variant->estorePack->pieces ?? 1;
                    $piecesAdded += $this->addToVariant($variant, $item, $item->quantity_received, $variant->estorePack->name ?? 'Piece', $piecesPerUnit, $recordedBy);

                    continue;
                }

                foreach ($variants as $variant) {
                    $pieces = $splits[$item->id][$variant->id] ?? 0;

                    if ($pieces > 0) {
                        $piecesAdded += $this->addToVariant($variant, $item, $pieces, 'Piece', 1, $recordedBy);
                    }
                }
            }

            // Stock went up, so a variant warned before may be warned again.
            foreach ($variantsByCode->flatten(1) as $variant) {
                $this->lowStockAlerts->check($variant);
            }

            return $piecesAdded;
        });
    }

    /**
     * Add every delivered item of the variant's eStore Item Code that is not
     * in stock yet, e.g. right after the Specialist links the code. Items
     * of a shared code wait for their split instead.
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
     * Split everything received of a shared code that is not in stock yet:
     * the pieces counted for each variant, which must add up to what
     * arrived. Older deliveries are filled first.
     *
     * @param  array<int, int>  $piecesByVariant
     * @return int pieces added to stock
     */
    public function splitWaiting(string $itemCode, array $piecesByVariant, User $recordedBy): int
    {
        return DB::transaction(function () use ($itemCode, $piecesByVariant, $recordedBy): int {
            $items = $this->waitingItems($itemCode);
            $piecesPerUnit = self::piecesPerUnit($itemCode);
            $arrived = (int) $items->sum('quantity_received') * $piecesPerUnit;

            if ($items->isEmpty() || array_sum($piecesByVariant) !== $arrived) {
                throw ValidationException::withMessages(['pieces' => 'What is waiting changed while you were typing. Please check it again.']);
            }

            return $this->add($items, $recordedBy, self::allocate($items, $piecesByVariant, $piecesPerUnit));
        });
    }

    /**
     * Share the pieces counted per variant over delivered items of one
     * shared code, the oldest first, so each delivered item gets exactly
     * its own number of pieces.
     *
     * @param  Collection<int, DeliveryItem>  $items
     * @param  array<int, int>  $piecesByVariant
     * @return array<int, array<int, int>> pieces by variant id, by delivery item id
     */
    public static function allocate(Collection $items, array $piecesByVariant, int $piecesPerUnit): array
    {
        $left = array_filter($piecesByVariant, fn (int $pieces): bool => $pieces > 0);
        $splits = [];

        foreach ($items->sortBy('id') as $item) {
            $needed = $item->quantity_received * $piecesPerUnit;

            foreach ($left as $variantId => $pieces) {
                if ($needed === 0) {
                    break;
                }

                $taken = min($needed, $pieces);
                $splits[$item->id][$variantId] = $taken;
                $needed -= $taken;
                $left[$variantId] -= $taken;

                if ($left[$variantId] === 0) {
                    unset($left[$variantId]);
                }
            }
        }

        return $splits;
    }

    /**
     * Pieces in one eStore unit of the code: 1 by the piece, or the pack's.
     */
    public static function piecesPerUnit(string $itemCode): int
    {
        $variant = ProductVariant::query()->with('estorePack')->where('estore_item_code', $itemCode)->first();

        return $variant?->estorePack->pieces ?? 1;
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

    private function addToVariant(ProductVariant $variant, DeliveryItem $item, int $units, string $unitName, int $piecesPerUnit, ?User $recordedBy): int
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
            'recorded_by' => $recordedBy?->id,
        ]);

        return $pieces;
    }
}
