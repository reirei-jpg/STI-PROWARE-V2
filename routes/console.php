<?php

use Illuminate\Support\Facades\Schedule;

// Delivery reminders for the Specialist (sent from 7:00 AM, once per date).
Schedule::command('deliveries:send-reminders')->hourly()->withoutOverlapping();
