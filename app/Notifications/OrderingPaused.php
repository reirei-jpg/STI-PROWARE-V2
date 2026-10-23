<?php

namespace App\Notifications;

use App\Notifications\Channels\PushChannel;
use App\Notifications\Channels\PushesToPhones;
use App\Services\Shop\OrderRules;
use Carbon\CarbonImmutable;
use Illuminate\Notifications\Notification;

/**
 * Tells a student their ordering is paused: too many of their orders
 * expired without being picked up, so they cannot place orders until the
 * date given (the PROWARE office can lift it sooner). Also pushed to their
 * phones.
 */
class OrderingPaused extends Notification implements PushesToPhones
{
    public function __construct(public CarbonImmutable $pausedUntil) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', PushChannel::class];
    }

    /**
     * @return array{kind: string, paused_until: string, expired_orders: int}
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'ordering_paused',
            'paused_until' => $this->pausedUntil->toDateString(),
            'expired_orders' => OrderRules::NO_SHOW_LIMIT,
        ];
    }

    /**
     * @return array{title: string, body: string, data: array<string, scalar|null>}
     */
    public function toPush(object $notifiable): array
    {
        return [
            'title' => 'Ordering is paused until '.$this->pausedUntil->format('M j, Y'),
            'body' => OrderRules::NO_SHOW_LIMIT.' of your orders expired without being picked up, so you cannot place orders until then. Ask the PROWARE office if this is a mistake.',
            'data' => ['kind' => 'ordering_paused'],
        ];
    }
}
