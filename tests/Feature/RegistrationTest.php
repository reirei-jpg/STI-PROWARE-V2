<?php

use App\Enums\UserRole;
use App\Models\User;

/**
 * @return array<string, string>
 */
function juansRegistration(array $changes = []): array
{
    return array_merge([
        'name' => 'Juan Dela Cruz',
        'last_name' => 'Dela Cruz',
        'student_id' => '02000123456',
        'section' => 'BSIT 1-A',
        'email' => 'delacruz.123456@sti.edu.ph',
        'password' => 'Demo@2026!',
        'password_confirmation' => 'Demo@2026!',
        'terms' => '1',
    ], $changes);
}

test('a student registers with the school email and is signed in', function () {
    $this->post(route('register.store'), juansRegistration())
        ->assertRedirect(config('fortify.home'));

    $juan = User::query()->where('email', 'delacruz.123456@sti.edu.ph')->sole();

    $this->assertAuthenticatedAs($juan);
    expect($juan->role)->toBe(UserRole::Student)
        ->and($juan->student_id)->toBe('02000123456')
        ->and($juan->section)->toBe('BSIT 1-A')
        ->and($juan->email_verified_at)->not->toBeNull();
});

test('a Student ID that already has an account cannot register again', function () {
    User::factory()->student()->create(['student_id' => '02000123456']);

    $this->post(route('register.store'), juansRegistration())
        ->assertSessionHasErrors(['student_id' => 'An account already uses this Student ID. Log in instead.']);

    $this->assertGuest();
});

test('the email must be the school email made from the last name and Student ID', function () {
    $this->post(route('register.store'), juansRegistration(['email' => 'juan@gmail.com']))
        ->assertSessionHasErrors(['email' => 'The expected school email is delacruz.123456@sti.edu.ph.']);

    $this->assertGuest();
});

test('registration refuses wrong details with plain messages', function (array $changes, string $field, string $message) {
    $this->post(route('register.store'), juansRegistration($changes))
        ->assertSessionHasErrors([$field => $message]);

    $this->assertGuest();
})->with([
    'name with numbers' => [['name' => 'Juan123'], 'name', 'The name may only contain letters, spaces, periods, hyphens and apostrophes.'],
    'last name with numbers' => [['last_name' => 'Cruz2'], 'last_name', 'The last name may only contain letters, spaces, periods, hyphens and apostrophes.'],
    'Student ID not 11 digits' => [['student_id' => '12345'], 'student_id', 'The Student ID must be exactly 11 digits.'],
    'password without a symbol' => [['password' => 'Demo2026', 'password_confirmation' => 'Demo2026'], 'password', 'Your password must include at least one special character (e.g. ! @ # $).'],
    'passwords do not match' => [['password_confirmation' => 'Other@2026!'], 'password', 'The password confirmation does not match.'],
    'information not confirmed' => [['terms' => ''], 'terms', 'Confirm that this information is yours.'],
]);

test('an email that already has an account cannot register again', function () {
    User::factory()->student()->create(['email' => 'delacruz.123456@sti.edu.ph']);

    $this->post(route('register.store'), juansRegistration())
        ->assertSessionHasErrors(['email' => 'An account already uses this email. Log in instead.']);
});

/**
 * @return array<string, string>
 */
function teachersRegistration(array $changes = []): array
{
    return array_merge([
        'account_type' => 'employee',
        'name' => 'Ana Lopez',
        'employee_id' => 'emp-0421',
        'section' => 'Faculty - IT',
        'email' => 'ana.lopez@ormoc.sti.edu.ph',
        'password' => 'Demo@2026!',
        'password_confirmation' => 'Demo@2026!',
        'terms' => '1',
    ], $changes);
}

test('an STI teacher or employee registers as STI Staff with an Employee ID and is signed in', function () {
    $this->post(route('register.store'), teachersRegistration())
        ->assertRedirect(config('fortify.home'));

    $ana = User::query()->where('email', 'ana.lopez@ormoc.sti.edu.ph')->sole();

    $this->assertAuthenticatedAs($ana);
    expect($ana->role)->toBe(UserRole::Employee)
        ->and($ana->employee_id)->toBe('EMP-0421')
        ->and($ana->student_id)->toBeNull()
        ->and($ana->section)->toBe('Faculty - IT')
        ->and($ana->email_verified_at)->not->toBeNull();
});

test('STI Staff registration refuses wrong details with plain messages', function (array $changes, string $field, string $message) {
    $this->post(route('register.store'), teachersRegistration($changes))
        ->assertSessionHasErrors([$field => $message]);

    $this->assertGuest();
})->with([
    'no Employee ID' => [['employee_id' => ''], 'employee_id', 'Enter your Employee ID.'],
    'Employee ID with symbols' => [['employee_id' => 'EMP#04'], 'employee_id', 'Use 3 to 20 letters, numbers or hyphens, as on your STI ID.'],
    'no office or department' => [['section' => ''], 'section', 'Enter your office or department, e.g. Faculty - IT or Registrar.'],
    'email outside STI' => [['email' => 'ana.lopez@gmail.com'], 'email', 'Use your STI email, ending in sti.edu.ph.'],
    'email that only looks like STI' => [['email' => 'ana@fakesti.edu.ph'], 'email', 'Use your STI email, ending in sti.edu.ph.'],
    'not Student or STI Staff' => [['account_type' => 'specialist'], 'account_type', 'Choose Student or STI Staff.'],
]);

test('an Employee ID that already has an account cannot register again', function () {
    User::factory()->employee()->create()->forceFill(['employee_id' => 'EMP-0421'])->save();

    $this->post(route('register.store'), teachersRegistration())
        ->assertSessionHasErrors(['employee_id' => 'An account already uses this Employee ID. Log in instead.']);

    $this->assertGuest();
});
