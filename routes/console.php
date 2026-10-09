<?php

use Illuminate\Support\Facades\Schedule;

// Delivery reminders for the Specialist (sent from 7:00 AM, once per date).
Schedule::command('deliveries:send-reminders')->hourly()->withoutOverlapping();

// Sales: end the ones whose days are up, and tell the Specialist the day
// before a sale ends (from 7:00 AM).
Schedule::command('sales:check')->hourly()->withoutOverlapping();

// Orders not picked up by their pick-up date cancel themselves and their
// stock goes back.
Schedule::command('orders:cancel-unclaimed')->hourly()->withoutOverlapping();
Schedule::command('orders:remind-last-day')->hourly()->withoutOverlapping();
