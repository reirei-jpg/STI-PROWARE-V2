<?php

use Illuminate\Support\Facades\Schedule;

// Sales: end the ones whose days are up, and tell the Specialist the day
// before a sale ends (from 7:00 AM).
Schedule::command('sales:check')->everyMinute()->withoutOverlapping();

// eStore orders not complete after the follow-up days are reported to the
// School Admin, once per order.
Schedule::command('purchase-orders:notify-late')->hourly()->withoutOverlapping();

// The Reorder Points look back on the last 30 days of sales, which move on
// each night.
Schedule::command('stock:reorder-points')->dailyAt('00:10')->withoutOverlapping();

// Preorders not paid by the close date of their payment dates are dropped.
Schedule::command('preorders:drop-unpaid')->everyMinute()->withoutOverlapping();
