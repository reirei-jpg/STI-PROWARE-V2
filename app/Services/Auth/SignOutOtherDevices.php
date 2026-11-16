<?php

namespace App\Services\Auth;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * After a new password, whoever knew the old one is signed out: every phone
 * (its app token) and every other browser, including one that ticked
 * "Remember me". The browser that changed the password stays signed in.
 * A locked account is signed out everywhere (no session is kept).
 */
final class SignOutOtherDevices
{
    public static function handle(User $user, ?string $keepSessionId = null): void
    {
        $user->tokens()->delete();

        // A "Remember me" cookie of the old password no longer signs in.
        $user->forceFill(['remember_token' => Str::random(60)])->save();

        DB::table((string) config('session.table', 'sessions'))
            ->where('user_id', $user->id)
            ->when($keepSessionId !== null, fn ($query) => $query->where('id', '!=', $keepSessionId))
            ->delete();
    }
}
