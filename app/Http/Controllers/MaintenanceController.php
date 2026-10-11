<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use App\Services\Settings\SystemSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The Specialist's Maintenance page: the settings that change how PROWARE
 * works without changing its code (SystemSettings), by area, each with its
 * current value and who changed it last. A change applies right away, to
 * what happens from then on.
 */
class MaintenanceController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('maintenance/index', [
            'areas' => SystemSettings::AREAS,
            'settings' => SystemSettings::rows(),
        ]);
    }

    /**
     * Change one setting: a number from its choices, or a short text.
     */
    public function update(Request $request, string $setting): RedirectResponse
    {
        abort_unless(SystemSettings::exists($setting), 404);

        $definition = SystemSettings::definition($setting);
        $maxLength = $definition['max_length'] ?? 100;

        $value = $definition['type'] === 'text'
            ? trim((string) $request->validate(
                ['value' => ['required', 'string', 'min:3', 'max:'.$maxLength]],
                [
                    'value.required' => 'Type the '.mb_strtolower($definition['label']).'.',
                    'value.min' => 'Type at least 3 characters.',
                    'value.max' => "Keep it to {$maxLength} characters or less.",
                ],
            )['value'])
            : (int) $request->validate(
                ['value' => ['required', 'integer', Rule::in($definition['choices'] ?? [])]],
                [
                    'value.required' => 'Choose one of the choices shown.',
                    'value.integer' => 'Choose one of the choices shown.',
                    'value.in' => 'Choose one of the choices shown.',
                ],
            )['value'];

        Setting::put($setting, $value, $request->user());

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => trim("{$definition['label']}: now ".SystemSettings::display($setting).'. '.($definition['saved_note'] ?? '')),
        ]);

        return back();
    }
}
