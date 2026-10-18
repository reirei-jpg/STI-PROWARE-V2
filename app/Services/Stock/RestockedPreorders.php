<?php

namespace App\Services\Stock;

use App\Enums\PreorderStatus;
use App\Models\Preorder;
use App\Models\ProductVariant;
use App\Models\User;
use App\Notifications\PreorderArrived;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

/**
 * Notifies students who preordered a sold-out size once it can be bought
 * again (a delivery, a recount, a cancelled order giving pieces back). Their
 * preorders become Arrived, so they stop counting as still to order;
 * nothing is held for them. A size marked "will not be restocked" can be
 * preordered again once it is back in stock and sold out again.
 */
final class RestockedPreorders
{
    /**
     * Run after a variant's stock changed. The notices are sent once the
     * change is saved.
     */
    public function check(ProductVariant $variant): void
    {
        $variant->loadMissing('product');

        if (! LowStockAlerts::isSold($variant->product) || $variant->freeToSell() === 0) {
            return;
        }

        if ($variant->not_restocked_at !== null) {
            $variant->forceFill(['not_restocked_at' => null])->save();
        }

        $preorders = Preorder::query()
            ->where('product_variant_id', $variant->id)
            ->where('status', PreorderStatus::Active);
        $students = User::query()->whereIn('id', (clone $preorders)->select('user_id'))->get();

        if ($students->isEmpty()) {
            return;
        }

        $preorders->update(['status' => PreorderStatus::Arrived, 'arrived_at' => now()]);

        DB::afterCommit(fn () => Notification::send($students, new PreorderArrived($variant->product, $variant)));
    }
}
