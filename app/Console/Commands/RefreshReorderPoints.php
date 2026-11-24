<?php

namespace App\Console\Commands;

use App\Models\ProductVariant;
use App\Services\Stock\LowStockAlerts;
use App\Services\Stock\ReorderPoints;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('stock:reorder-points {--without-notices : Mark sizes already at their Reorder Point as warned instead of notifying (first run)}')]
#[Description('Work out every size and color\'s Reorder Point again from its last 30 days of sales')]
class RefreshReorderPoints extends Command
{
    /**
     * Each night the last 30 days move on, so every Reorder Point is worked
     * out again. A size whose new Reorder Point reaches its stock is warned
     * like any other (once). The first run, --without-notices, only marks
     * them, so the Specialist is not sent one notice per item at once; they
     * still show in the Reorder list and on the Dashboard.
     */
    public function handle(ReorderPoints $reorderPoints, LowStockAlerts $lowStockAlerts): int
    {
        $changed = $reorderPoints->refreshAll();

        foreach ($changed as $variant) {
            if (! $this->option('without-notices')) {
                $lowStockAlerts->check($variant);

                continue;
            }

            if ($variant->low_stock_notified_at === null && ! $variant->isDraft() && LowStockAlerts::isSold($variant->product) && $variant->freeToSell() <= $variant->reorder_point) {
                $variant->forceFill(['low_stock_notified_at' => now(), 'low_stock_notified_stock' => $variant->stock_on_hand])->save();
            }
        }

        $this->info("Reorder Points worked out again: {$changed->count()} of ".ProductVariant::query()->count().' changed.');

        return self::SUCCESS;
    }
}
