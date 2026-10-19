<?php

namespace App\Console\Commands;

use App\Services\Preorders\PreorderHolds;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('preorders:end-holds')]
#[Description('End holds on arrived preorders not ordered within 24 hours, so the pieces go to the next student')]
class EndPreorderHolds extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(PreorderHolds $holds): int
    {
        $this->info("Ended {$holds->endExpired()} hold(s) not ordered in time.");

        return self::SUCCESS;
    }
}
