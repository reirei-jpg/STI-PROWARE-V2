<?php

namespace App\Console\Commands;

use App\Actions\Orders\CancelOrder;
use App\Models\Order;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('orders:cancel-unclaimed')]
#[Description('Expire orders not released by their pick-up date, so their held items are free to sell again')]
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

        $this->info("Expired {$orders->count()} order(s) not picked up in time.");

        return self::SUCCESS;
    }
}
