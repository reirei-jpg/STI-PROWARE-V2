<?php

namespace App\Console\Commands;

use App\Enums\UserRole;
use App\Models\User;
use App\Notifications\PurchaseOrderLate;
use App\Services\Deliveries\FollowUp;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Notification;

#[Signature('purchase-orders:notify-late')]
#[Description('Tell the School Admin about eStore orders not complete after the follow-up days')]
class NotifyLatePurchaseOrders extends Command
{
    /**
     * Each open order dated the Maintenance days ago or earlier is reported
     * to every School Admin once.
     */
    public function handle(): int
    {
        $lateDays = FollowUp::days();
        $orders = FollowUp::dueOrders()->whereNull('late_notified_at')->get();
        $schoolAdmins = User::query()->where('role', UserRole::SchoolAdmin)->get();

        foreach ($orders as $order) {
            $order->forceFill(['late_notified_at' => now()])->save();
            Notification::send($schoolAdmins, new PurchaseOrderLate($order, $lateDays));
        }

        $this->info("Reported {$orders->count()} late order(s) to the School Admin.");

        return self::SUCCESS;
    }
}
