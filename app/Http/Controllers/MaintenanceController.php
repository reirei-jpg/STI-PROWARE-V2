<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use App\Services\Shop\OrderRules;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The Specialist's Maintenance page: settings that change how PROWARE
 * works without changing its code, each with who changed it last. For now:
 * how many days a new order holds its items before it expires.
 */
class MaintenanceController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('maintenance/index', [
            'holdDays' => [
                'value' => OrderRules::holdDays(),
                'min' => OrderRules::MIN_HOLD_DAYS,
                'max' => OrderRules::MAX_HOLD_DAYS,
                ...Setting::lastChange(Setting::ORDER_HOLD_DAYS),
            ],
        ]);
    }

    /**
     * How many days new orders hold their items (1 to 3). Orders already
     * placed keep their pick-up date.
     */
    public function updateHoldDays(Request $request): RedirectResponse
    {
        $days = (int) $request->validate(
            ['hold_days' => ['required', 'integer', 'between:'.OrderRules::MIN_HOLD_DAYS.','.OrderRules::MAX_HOLD_DAYS]],
            ['hold_days.between' => 'Choose 1, 2 or 3 days.', 'hold_days.required' => 'Choose 1, 2 or 3 days.'],
        )['hold_days'];

        Setting::put(Setting::ORDER_HOLD_DAYS, $days, $request->user());

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'New orders now hold their items for '.$days.' '.($days === 1 ? 'day' : 'days').'. Orders already placed keep their pick-up date.',
        ]);

        return back();
    }
}
