<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ProfileUpdateRequest;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

/**
 * A staff member's profile: their name can be changed here. The email is
 * shown only, since changing it needs the new address verified by email;
 * the system administrator changes it.
 */
class ProfileController extends Controller
{
    public function edit(): Response
    {
        return Inertia::render('settings/profile');
    }

    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $request->user()->update(['name' => $request->validated('name')]);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Your profile has been updated.']);

        return to_route('profile.edit');
    }
}
