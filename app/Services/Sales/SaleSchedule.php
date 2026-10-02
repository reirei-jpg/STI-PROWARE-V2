<?php

namespace App\Services\Sales;

use App\Actions\Sales\EndSale;
use App\Enums\ProductStatus;
use App\Enums\UserRole;
use App\Models\Product;
use App\Models\User;
use App\Notifications\SaleEnded;
use App\Notifications\SaleEndingSoon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Notification;

/**
 * Runs every hour: ends sales whose days are up (the product goes back to
 * Available and the Specialist is told), and from 7:00 AM tells her about
 * sales ending tomorrow, once per sale.
 */
class SaleSchedule
{
    public const SEND_FROM_HOUR = 7;

    public function __construct(private EndSale $endSale) {}

    /**
     * @return int how many sales ended
     */
    public function endExpired(): int
    {
        $ended = 0;

        foreach (Product::query()->where('status', ProductStatus::OnSale)->where('sale_ends_at', '<=', now())->get() as $product) {
            $this->endSale->handle($product);
            Notification::send($this->specialists(), new SaleEnded($product));
            $ended++;
        }

        return $ended;
    }

    /**
     * @return int how many "sale ending tomorrow" notices were sent
     */
    public function sendEndingReminders(): int
    {
        if (now()->hour < self::SEND_FROM_HOUR) {
            return 0;
        }

        $tomorrow = now()->addDay();
        $sent = 0;

        $endingTomorrow = Product::query()
            ->where('status', ProductStatus::OnSale)
            ->whereNull('sale_ending_notified_at')
            ->whereBetween('sale_ends_at', [$tomorrow->copy()->startOfDay(), $tomorrow->copy()->endOfDay()])
            ->get();

        foreach ($endingTomorrow as $product) {
            Notification::send($this->specialists(), new SaleEndingSoon($product));
            $product->forceFill(['sale_ending_notified_at' => now()])->save();
            $sent++;
        }

        return $sent;
    }

    /**
     * @return Collection<int, User>
     */
    private function specialists(): Collection
    {
        return User::query()->where('role', UserRole::Specialist)->get();
    }
}
