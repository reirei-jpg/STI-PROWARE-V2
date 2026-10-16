<?php

namespace App\Http\Requests;

use Laravel\Fortify\Http\Requests\LoginRequest as FortifyLoginRequest;

/**
 * The website's login (Fortify's rules), with PROWARE's words for empty
 * boxes. A wrong email or password, and too many tries, are worded in the
 * FortifyServiceProvider.
 */
class LoginRequest extends FortifyLoginRequest
{
    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'email.required' => 'Enter your email address.',
            'password.required' => 'Enter your password.',
        ];
    }
}
