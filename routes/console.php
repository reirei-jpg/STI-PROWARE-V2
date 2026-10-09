<?php

use Illuminate\Support\Facades\Schedule;

// Sales: end the ones whose days are up, and tell the Specialist the day
// before a sale ends (from 7:00 AM).
Schedule::command('sales:check')->hourly()->withoutOverlapping();

// Orders not picked up by their pick-up date cancel themselves and their
// stock goes back.
Schedule::command('orders:cancel-unclaimed')->hourly()->withoutOverlapping();
Schedule::command('orders:remind-last-day')->hourly()->withoutOverlapping();
