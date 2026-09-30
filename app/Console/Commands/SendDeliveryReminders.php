<?php

namespace App\Console\Commands;

use App\Services\Deliveries\DeliveryReminders;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('deliveries:send-reminders')]
#[Description('Notify the Specialist about deliveries expected tomorrow or today')]
class SendDeliveryReminders extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(DeliveryReminders $reminders): int
    {
        $sent = $reminders->sendDue();

        $this->info("Sent {$sent} delivery reminder(s).");

        return self::SUCCESS;
    }
}
