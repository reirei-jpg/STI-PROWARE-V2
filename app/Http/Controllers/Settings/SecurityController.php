<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\PasswordUpdateRequest;
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
        if ($request->user()->isStudent()) {
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

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Your password has been changed.']);

        return back();
    }
}
