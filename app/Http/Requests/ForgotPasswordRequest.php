<?php

namespace App\Http\Requests;

use Laravel\Fortify\Http\Requests\SendPasswordResetLinkRequest;

/**
 * Forgot password (Fortify's rules), with PROWARE's words for an empty or
 * wrong email box. Whether the email has an account is never said (see
 * PasswordResetLinkResponse).
 */
class ForgotPasswordRequest extends SendPasswordResetLinkRequest
{
    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'email.required' => 'Enter your email address.',
            'email.email' => 'Enter a valid email address, e.g. delacruz.123456@sti.edu.ph.',
        ];
    }
}
