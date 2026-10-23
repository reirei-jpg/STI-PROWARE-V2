<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ProfileUpdateRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Your profile: the name can be changed here. The email is shown only,
 * since changing it needs the new address verified by email. Students get
 * one My Account page in the store (name, Student ID, password).
 */
class ProfileController extends Controller
{
    public function edit(Request $request): Response
    {
        return $request->user()->isStudent()
            ? Inertia::render('storefront/account', ['passwordRules' => Password::defaults()->toPasswordRulesString()])
            : Inertia::render('settings/profile');
    }

    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $request->user()->update(['name' => $request->validated('name')]);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Your profile has been updated.']);

        return to_route('profile.edit');
    }
}
