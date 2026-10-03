<?php

namespace App\Console\Commands;

use App\Actions\Orders\CancelOrder;
use App\Models\Order;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('orders:cancel-unclaimed')]
#[Description('Cancel orders not picked up by their pick-up date and put their stock back')]
class CancelUnclaimedOrders extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(CancelOrder $cancelOrder): int
    {
        $orders = Order::query()->open()->where('pick_up_by', '<', now())->get();

        foreach ($orders as $order) {
            $cancelOrder->handle($order, null, 'Not picked up by '.$order->pick_up_by->format('M j, Y').'.');
        }

        $this->info("Cancelled {$orders->count()} order(s) not picked up in time.");

        return self::SUCCESS;
    }
}
