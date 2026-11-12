<?php

use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-11-12 14:30', 'Asia/Manila'));
    $this->buyer = User::factory()->student()->create(['email' => 'delacruz.123456@sti.edu.ph']);
});

const WRONG_PASSWORD_MESSAGE = 'These credentials do not match our records. Check the email and password.';
const LOCKED_MESSAGE = 'This account is locked after 5 wrong passwords in a row. Try again at 2:45 PM.';

/**
 * Signs in on the website with this password.
 */
function signInOnWebsite(string $email, string $password): TestResponse
{
    return test()->post(route('login.store'), ['email' => $email, 'password' => $password]);
}

test('the 5th wrong password in a row locks the account for 15 minutes, even for the right password', function () {
    foreach (range(1, 4) as $try) {
        signInOnWebsite($this->buyer->email, 'Wrong@2026!')->assertSessionHasErrors(['email' => WRONG_PASSWORD_MESSAGE]);
    }

    signInOnWebsite($this->buyer->email, 'Wrong@2026!')->assertSessionHasErrors(['email' => LOCKED_MESSAGE]);
    signInOnWebsite($this->buyer->email, 'password')->assertSessionHasErrors(['email' => LOCKED_MESSAGE]);
    $this->assertGuest();

    // The lock ends by itself after 15 minutes.
    $this->travel(15)->minutes();
    signInOnWebsite($this->buyer->email, 'password')->assertSessionHasNoErrors();
    $this->assertAuthenticatedAs($this->buyer);
    expect($this->buyer->refresh())->failed_sign_ins->toBe(0)->locked_until->toBeNull();
});

test('a correct sign-in starts the count again', function () {
    foreach (range(1, 4) as $try) {
        signInOnWebsite($this->buyer->email, 'Wrong@2026!');
    }

    signInOnWebsite($this->buyer->email, 'password')->assertSessionHasNoErrors();
    auth()->logout();

    // 4 more wrong passwords do not lock it: the count started again.
    foreach (range(1, 4) as $try) {
        signInOnWebsite($this->buyer->email, 'Wrong@2026!')->assertSessionHasErrors(['email' => WRONG_PASSWORD_MESSAGE]);
    }

    expect($this->buyer->refresh()->locked_until)->toBeNull();
});

test('waiting a minute does not get around the lock, unlike the per-minute limit', function () {
    foreach (range(1, 4) as $try) {
        signInOnWebsite($this->buyer->email, 'Wrong@2026!');
        $this->travel(1)->minutes();
    }

    signInOnWebsite($this->buyer->email, 'Wrong@2026!')->assertSessionHasErrors(['email' => 'This account is locked after 5 wrong passwords in a row. Try again at 2:49 PM.']);
});

test('the phone app has the same lock, and locking signs the account out of every phone', function () {
    $this->buyer->createToken('realme RMX3999');

    foreach (range(1, 4) as $try) {
        $this->postJson(route('api.v1.auth.login'), ['email' => $this->buyer->email, 'password' => 'Wrong@2026!', 'device_name' => 'phone'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.email.0', WRONG_PASSWORD_MESSAGE);
    }

    $this->postJson(route('api.v1.auth.login'), ['email' => $this->buyer->email, 'password' => 'Wrong@2026!', 'device_name' => 'phone'])
        ->assertJsonPath('errors.email.0', LOCKED_MESSAGE);
    expect($this->buyer->tokens()->count())->toBe(0);

    // Locked on the website too, and the right password on the phone is refused.
    signInOnWebsite($this->buyer->email, 'password')->assertSessionHasErrors(['email' => LOCKED_MESSAGE]);
    $this->postJson(route('api.v1.auth.login'), ['email' => $this->buyer->email, 'password' => 'password', 'device_name' => 'phone'])
        ->assertJsonPath('errors.email.0', LOCKED_MESSAGE);
});

test('an email that is not an account locks nothing and says the same as a wrong password', function () {
    foreach (range(1, 6) as $try) {
        signInOnWebsite('nobody.000000@sti.edu.ph', 'Wrong@2026!')->assertSessionHasErrors(['email' => WRONG_PASSWORD_MESSAGE]);
    }

    signInOnWebsite($this->buyer->email, 'password')->assertSessionHasNoErrors();
});

test('a new password from Forgot password ends the lock', function () {
    $this->buyer->forceFill(['locked_until' => now()->addMinutes(15)])->save();
    $token = Password::createToken($this->buyer);

    $this->post(route('password.update'), [
        'token' => $token,
        'email' => $this->buyer->email,
        'password' => 'NewPass@2026!',
        'password_confirmation' => 'NewPass@2026!',
    ])->assertSessionHasNoErrors();

    expect($this->buyer->refresh()->locked_until)->toBeNull();
    signInOnWebsite($this->buyer->email, 'NewPass@2026!')->assertSessionHasNoErrors();
});
