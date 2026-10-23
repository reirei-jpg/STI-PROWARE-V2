<?php

namespace App\Actions\Fortify;

use App\Concerns\PasswordValidationRules;
use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Validator as ValidatorInstance;
use Laravel\Fortify\Contracts\CreatesNewUsers;

/**
 * Temporary student registration, as on V1, until STI's Microsoft 365
 * sign-in is connected: the student's name, 11-digit Student ID, and the
 * school email made from their last name and the last 6 digits of the
 * Student ID (e.g. delacruz.123456@sti.edu.ph). The account is a student's,
 * signed in right away.
 */
class CreateNewUser implements CreatesNewUsers
{
    use PasswordValidationRules;

    /**
     * Validate and create a newly registered student.
     *
     * @param  array<string, string>  $input
     */
    public function create(array $input): User
    {
        $input['email'] = Str::lower(trim((string) ($input['email'] ?? '')));

        $validator = Validator::make($input, [
            'name' => ['required', 'string', 'max:120', 'regex:'.User::NAME_PATTERN],
            'last_name' => ['required', 'string', 'max:60', 'regex:'.User::NAME_PATTERN],
            'student_id' => ['required', 'digits:11', 'unique:users,student_id'],
            'section' => ['nullable', 'string', 'max:40'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => $this->passwordRules(),
            'terms' => ['accepted'],
        ], [
            ...$this->passwordMessages(),
            'name.required' => 'Enter your full name.',
            'name.regex' => 'The name may only contain letters, spaces, periods, hyphens and apostrophes.',
            'last_name.required' => 'Enter your last name, as in your school email.',
            'last_name.regex' => 'The last name may only contain letters, spaces, periods, hyphens and apostrophes.',
            'student_id.required' => 'Enter your Student ID.',
            'student_id.digits' => 'The Student ID must be exactly 11 digits.',
            'student_id.unique' => 'An account already uses this Student ID. Log in instead.',
            'section.max' => 'The course/section may not be longer than 40 characters, e.g. BSIT 1-A.',
            'email.required' => 'Enter your STI school email.',
            'email.email' => 'Enter a valid email address.',
            'email.unique' => 'An account already uses this email. Log in instead.',
            'terms.accepted' => 'Confirm that this information is yours.',
        ]);

        $validator->after(function (ValidatorInstance $validator) use ($input): void {
            if ($validator->errors()->hasAny(['last_name', 'student_id', 'email'])) {
                return;
            }

            $expected = self::schoolEmail((string) $input['student_id'], (string) $input['last_name']);

            if ($input['email'] !== $expected) {
                $validator->errors()->add('email', "The expected school email is {$expected}.");
            }
        });

        $validated = $validator->validate();

        $student = User::query()->create([
            'name' => preg_replace('/\s+/', ' ', trim((string) $validated['name'])),
            'email' => $validated['email'],
            'role' => UserRole::Student,
            'password' => $validated['password'],
        ]);

        $student->forceFill([
            'student_id' => (string) $validated['student_id'],
            'section' => filled($validated['section'] ?? null) ? trim((string) $validated['section']) : null,
            // The school email's format is checked above; there is no mail to verify it with yet.
            'email_verified_at' => now(),
        ])->save();

        return $student;
    }

    /**
     * The STI school email: the last name (letters and numbers only) and
     * the last 6 digits of the Student ID, e.g. delacruz.123456@sti.edu.ph.
     */
    public static function schoolEmail(string $studentId, string $lastName): string
    {
        $last = preg_replace('/[^a-z0-9]/', '', Str::lower(Str::ascii(trim($lastName)))) ?? '';

        return $last.'.'.substr(trim($studentId), -6).'@sti.edu.ph';
    }
}
