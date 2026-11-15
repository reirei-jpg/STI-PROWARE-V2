<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\Auth\SignInLock;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * Unlocking an account locked after 5 wrong passwords, before its 15
 * minutes are up: the Specialist for a student or STI staff (Maintenance),
 * the School Admin for the Specialist (Dashboard).
 */
class LockedAccountController extends Controller
{
    public function unlock(Request $request, User $user): RedirectResponse
    {
        abort_unless(SignInLock::canUnlock($request->user(), $user), 403);

        $result = SignInLock::unlock($request->user(), $user);

        Inertia::flash('toast', ['type' => $result['unlocked'] ? 'success' : 'info', 'message' => $result['message']]);

        return back();
    }
}
