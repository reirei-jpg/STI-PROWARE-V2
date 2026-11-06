<?php

namespace App\Actions\Fortify;

use App\Concerns\PasswordValidationRules;
use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator as ValidatorInstance;
use Laravel\Fortify\Contracts\CreatesNewUsers;

/**
 * Temporary registration, as on V1, until STI's Microsoft 365 sign-in is
 * connected. A student gives their name, 11-digit Student ID, and the
 * school email made from their last name and the last 6 digits of the
 * Student ID (e.g. delacruz.123456@sti.edu.ph). STI staff (teachers and
 * employees) give their name, Employee ID, office/department and their STI
 * email (ending in sti.edu.ph). The account is signed in right away.
 */
class CreateNewUser implements CreatesNewUsers
{
    use PasswordValidationRules;

    /**
     * Who can register: students and STI staff.
     */
    public const ACCOUNT_TYPES = ['student', 'employee'];

    /**
     * An Employee ID: letters, numbers and hyphens, e.g. "EMP-0157".
     */
    public const EMPLOYEE_ID_PATTERN = '/^[A-Za-z0-9][A-Za-z0-9-]{2,19}$/';

    /**
     * Validate and create a newly registered student or STI staff buyer.
     *
     * @param  array<string, string>  $input
     */
    public function create(array $input): User
    {
        $input['email'] = Str::lower(trim((string) ($input['email'] ?? '')));
        $input['employee_id'] = Str::upper(trim((string) ($input['employee_id'] ?? '')));
        $isEmployee = ($input['account_type'] ?? 'student') === 'employee';

        $validator = Validator::make($input, [
            'account_type' => ['nullable', Rule::in(self::ACCOUNT_TYPES)],
            'name' => ['required', 'string', 'max:120', 'regex:'.User::NAME_PATTERN],
            'last_name' => [Rule::requiredIf(! $isEmployee), 'nullable', 'string', 'max:60', 'regex:'.User::NAME_PATTERN],
            'student_id' => $isEmployee ? ['exclude'] : ['required', 'digits:11', 'unique:users,student_id'],
            'employee_id' => $isEmployee ? ['required', 'string', 'regex:'.self::EMPLOYEE_ID_PATTERN, 'unique:users,employee_id'] : ['exclude'],
            'section' => [Rule::requiredIf($isEmployee), 'nullable', 'string', 'max:40', 'regex:'.User::SECTION_PATTERN],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => $this->passwordRules(),
            'terms' => ['accepted'],
        ], [
            ...$this->passwordMessages(),
            'account_type.in' => 'Choose Student or STI Staff.',
            'name.required' => 'Enter your full name.',
            'name.regex' => 'The name may only contain letters, spaces, periods, hyphens and apostrophes.',
            'last_name.required' => 'Enter your last name, as in your school email.',
            'last_name.regex' => 'The last name may only contain letters, spaces, periods, hyphens and apostrophes.',
            'student_id.required' => 'Enter your Student ID.',
            'student_id.digits' => 'The Student ID must be exactly 11 digits.',
            'student_id.unique' => 'An account already uses this Student ID. Log in instead.',
            'employee_id.required' => 'Enter your Employee ID.',
            'employee_id.regex' => 'Use 3 to 20 letters, numbers or hyphens, as on your STI ID.',
            'employee_id.unique' => 'An account already uses this Employee ID. Log in instead.',
            'section.required' => 'Enter your office or department, e.g. Faculty - IT or Registrar.',
            'section.max' => $isEmployee
                ? 'The office/department may not be longer than 40 characters.'
                : 'The course/section may not be longer than 40 characters, e.g. BSIT 1-A.',
            'section.regex' => $isEmployee
                ? 'The office/department may only contain letters, numbers, spaces and . , - / \' & ( ).'
                : User::SECTION_MESSAGE,
            'email.required' => $isEmployee ? 'Enter your STI email.' : 'Enter your STI school email.',
            'email.email' => 'Enter a valid email address.',
            'email.unique' => 'An account already uses this email. Log in instead.',
            'terms.accepted' => 'Confirm that this information is yours.',
        ]);

        $validator->after(function (ValidatorInstance $validator) use ($input, $isEmployee): void {
            if ($isEmployee) {
                if (! $validator->errors()->has('email') && ! self::isStiEmail($input['email'])) {
                    $validator->errors()->add('email', 'Use your STI email, ending in sti.edu.ph.');
                }

                return;
            }

            if ($validator->errors()->hasAny(['last_name', 'student_id', 'email'])) {
                return;
            }

            $expected = self::schoolEmail((string) $input['student_id'], (string) $input['last_name']);

            if ($input['email'] !== $expected) {
                $validator->errors()->add('email', "The expected school email is {$expected}.");
            }
        });

        $validated = $validator->validate();

        $user = User::query()->create([
            'name' => preg_replace('/\s+/', ' ', trim((string) $validated['name'])),
            'email' => $validated['email'],
            'role' => $isEmployee ? UserRole::Employee : UserRole::Student,
            'password' => $validated['password'],
        ]);

        $user->forceFill([
            'student_id' => $isEmployee ? null : (string) $validated['student_id'],
            'employee_id' => $isEmployee ? (string) $validated['employee_id'] : null,
            'section' => filled($validated['section'] ?? null) ? preg_replace('/\s+/', ' ', trim((string) $validated['section'])) : null,
            // The school email's format is checked above; there is no mail to verify it with yet.
            'email_verified_at' => now(),
        ])->save();

        return $user;
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

    /**
     * An STI email: @sti.edu.ph, or a campus or office address under it
     * (e.g. @novaliches.sti.edu.ph).
     */
    public static function isStiEmail(string $email): bool
    {
        return preg_match('/@([a-z0-9-]+\.)*sti\.edu\.ph$/', $email) === 1;
    }
}
