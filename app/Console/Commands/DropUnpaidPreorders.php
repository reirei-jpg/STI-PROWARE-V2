<?php

namespace App\Console\Commands;

use App\Services\Preorders\PaymentDates;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('preorders:drop-unpaid')]
#[Description('Drop preorders not paid by the close date of their payment dates, and tell the buyers')]
class DropUnpaidPreorders extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('Dropped '.PaymentDates::dropUnpaid().' unpaid preorder(s).');

        return self::SUCCESS;
    }
}
