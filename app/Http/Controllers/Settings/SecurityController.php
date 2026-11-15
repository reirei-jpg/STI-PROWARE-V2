<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\PasswordUpdateRequest;
use App\Services\Auth\SignOutOtherDevices;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Your password: changed with the current one. Students change it on their
 * My Account page. (Two-step login and passkeys are not used in PROWARE for
 * now.)
 */
class SecurityController extends Controller
{
    public function edit(Request $request): Response|RedirectResponse
    {
        if ($request->user()->isBuyer()) {
            return to_route('profile.edit');
        }

        return Inertia::render('settings/security', [
            'passwordRules' => Password::defaults()->toPasswordRulesString(),
        ]);
    }

    public function update(PasswordUpdateRequest $request): RedirectResponse
    {
        $request->user()->update([
            'password' => $request->password,
        ]);

        // Whoever knew the old password is signed out: other browsers and every phone.
        SignOutOtherDevices::handle($request->user(), $request->session()->getId());

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Your password has been changed. You were signed out on every other device and phone.']);

        return back();
    }
}
