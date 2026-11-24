<?php

namespace App\Services\Preorders;

use App\Enums\PreorderKind;
use App\Enums\PreorderStatus;
use App\Models\Preorder;
use App\Models\ProductVariant;
use Illuminate\Database\Eloquent\Builder;

/**
 * Back Orders (panel revision A2): buyers' orders of a size that is sold out
 * in the store, filled when stock arrives. Each has one of four statuses,
 * kept apart from each other: Pending (waiting for stock), Filled (stock came
 * and was given or held for them), Cancelled (by the buyer, or not paid in
 * time) and Not restocked (Head Office will not send it). PROWARE has no
 * returned orders: a release is final and there are no refunds.
 */
final class BackOrders
{
    /** The statuses, in the words shown, and the preorder statuses each covers. */
    public const STATUSES = [
        'pending' => ['label' => 'Pending', 'statuses' => [PreorderStatus::Active]],
        'filled' => ['label' => 'Filled', 'statuses' => [PreorderStatus::Arrived, PreorderStatus::Held, PreorderStatus::Ordered]],
        'cancelled' => ['label' => 'Cancelled', 'statuses' => [PreorderStatus::Cancelled, PreorderStatus::NotPaid, PreorderStatus::HoldEnded]],
        'not_restocked' => ['label' => 'Not restocked', 'statuses' => [PreorderStatus::NotRestocked]],
    ];

    /**
     * @return Builder<Preorder>
     */
    public static function query(): Builder
    {
        return Preorder::query()->where('kind', PreorderKind::BackOrder);
    }

    /** "pending", "filled", "cancelled" or "not_restocked". */
    public static function statusOf(Preorder $preorder): string
    {
        foreach (self::STATUSES as $key => $status) {
            if (in_array($preorder->status, $status['statuses'], true)) {
                return $key;
            }
        }

        return 'pending';
    }

    /**
     * How many back orders have each status (pieces, buyers, sizes), and the
     * returned orders, which PROWARE does not have.
     *
     * @return array<string, array{label: string, pieces: int, buyers: int, sizes: int}>
     */
    public static function counts(): array
    {
        $counts = [];

        foreach (self::STATUSES as $key => $status) {
            $rows = self::query()->whereIn('status', $status['statuses']);

            $counts[$key] = [
                'label' => $status['label'],
                'pieces' => (int) (clone $rows)->sum('quantity'),
                'buyers' => (clone $rows)->distinct()->count('user_id'),
                'sizes' => (clone $rows)->distinct()->count('product_variant_id'),
            ];
        }

        return $counts;
    }

    /**
     * Pieces on pending back orders, by variant id: the suggested reorder
     * covers them too.
     *
     * @param  iterable<ProductVariant>  $variants
     * @return array<int, int>
     */
    public static function pendingPieces(iterable $variants): array
    {
        $ids = collect($variants)->pluck('id')->all();

        if ($ids === []) {
            return [];
        }

        return self::query()
            ->where('status', PreorderStatus::Active)
            ->whereIn('product_variant_id', $ids)
            ->groupBy('product_variant_id')
            ->selectRaw('product_variant_id, sum(quantity) as pieces')
            ->pluck('pieces', 'product_variant_id')
            ->map(fn (mixed $pieces): int => (int) $pieces)
            ->all();
    }
}
