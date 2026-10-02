<?php

namespace App\Console\Commands;

use App\Services\Sales\SaleSchedule;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('sales:check')]
#[Description('End sales whose days are up and tell the Specialist about sales ending tomorrow')]
class CheckSales extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(SaleSchedule $sales): int
    {
        $ended = $sales->endExpired();
        $reminded = $sales->sendEndingReminders();

        $this->info("Ended {$ended} sale(s); sent {$reminded} sale-ending notice(s).");

        return self::SUCCESS;
    }
}
