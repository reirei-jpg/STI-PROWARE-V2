<?php

namespace App\Actions\Fortify;

use App\Concerns\PasswordValidationRules;
use App\Models\User;
use App\Services\Auth\SignInLock;
use App\Services\Auth\SignOutOtherDevices;
use Illuminate\Support\Facades\Validator;
use Laravel\Fortify\Contracts\ResetsUserPasswords;

class ResetUserPassword implements ResetsUserPasswords
{
    use PasswordValidationRules;

    /**
     * Validate and reset the user's forgotten password.
     *
     * @param  array<string, string>  $input
     */
    public function reset(User $user, array $input): void
    {
        Validator::make($input, [
            'password' => $this->passwordRules(),
        ], $this->passwordMessages())->validate();

        $user->forceFill([
            'password' => $input['password'],
        ])->save();

        // A new password ends a lock from wrong passwords, and whoever knew
        // the old one is signed out everywhere.
        SignInLock::clear($user);
        SignOutOtherDevices::handle($user);
    }
}
