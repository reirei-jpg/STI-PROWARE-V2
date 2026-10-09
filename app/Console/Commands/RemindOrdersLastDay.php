<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Notifications\OrderLastDay;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('orders:remind-last-day')]
#[Description('Remind students on the last day to get an order before it expires')]
class RemindOrdersLastDay extends Command
{
    /**
     * From 7 AM on an open order's last day, its student is reminded once.
     */
    public function handle(): int
    {
        if (now()->hour < 7) {
            $this->info('Too early to remind anyone.');

            return self::SUCCESS;
        }

        $orders = Order::query()
            ->open()
            ->whereNull('expiry_reminded_at')
            ->whereBetween('pick_up_by', [now(), now()->endOfDay()])
            ->with('student')
            ->get();

        foreach ($orders as $order) {
            $order->forceFill(['expiry_reminded_at' => now()])->save();
            $order->student->notify(new OrderLastDay($order));
        }

        $this->info("Reminded {$orders->count()} student(s) of their order's last day.");

        return self::SUCCESS;
    }
}
