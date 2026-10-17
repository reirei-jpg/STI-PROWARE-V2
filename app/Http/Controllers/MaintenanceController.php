<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdateSettingsRequest;
use App\Services\Settings\SystemSettings;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The Specialist's Maintenance page: the settings that change how PROWARE
 * works without changing its code (SystemSettings), grouped by area, each
 * with who changed it last. They are saved together with one button.
 */
class MaintenanceController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('maintenance/index', [
            'areas' => SystemSettings::forPage(),
        ]);
    }

    /**
     * Save the settings that changed. Orders, groups and slips already made
     * keep what they had.
     */
    public function update(UpdateSettingsRequest $request): RedirectResponse
    {
        $saved = SystemSettings::save($request->validated(), $request->user());

        Inertia::flash('toast', $saved === []
            ? ['type' => 'info', 'message' => 'There were no changes to save.']
            : ['type' => 'success', 'message' => (count($saved) === 1 ? 'This setting has been saved: ' : 'These settings have been saved: ').implode(', ', $saved).'.']);

        return back();
    }
}
