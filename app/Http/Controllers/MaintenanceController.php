<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use App\Services\Deliveries\FollowUp;
use App\Services\Shop\OrderRules;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The Specialist's Maintenance page: settings that change how PROWARE
 * works without changing its code, each with who changed it last: how many
 * days a new order holds its items before it expires, and after how many
 * days a purchase order not complete is to be followed up.
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
            'followUpDays' => [
                'value' => FollowUp::days(),
                'choices' => FollowUp::CHOICES,
                ...Setting::lastChange(Setting::DELIVERY_FOLLOW_UP_DAYS),
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

    /**
     * After how many days from its Date Ordered a purchase order not
     * complete is shown to follow up with Head Office.
     */
    public function updateFollowUpDays(Request $request): RedirectResponse
    {
        $choices = implode(', ', FollowUp::CHOICES);
        $days = (int) $request->validate(
            ['follow_up_days' => ['required', 'integer', 'in:'.implode(',', FollowUp::CHOICES)]],
            ['follow_up_days.in' => "Choose {$choices} days.", 'follow_up_days.required' => "Choose {$choices} days."],
        )['follow_up_days'];

        Setting::put(Setting::DELIVERY_FOLLOW_UP_DAYS, $days, $request->user());

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => "Purchase orders not complete after {$days} days are now shown to follow up with Head Office.",
        ]);

        return back();
    }
}
