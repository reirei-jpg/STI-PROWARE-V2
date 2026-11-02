<?php

use App\Models\User;
use App\Services\Auth\SignInExpiry;
use Illuminate\Session\TokenMismatchException;
use Illuminate\Support\Facades\Route;

beforeEach(function () {
    // A button pressed on a page left open too long: Laravel refuses it as
    // 419 Page Expired. Tests skip the real token check, so this stands in.
    Route::post('/expired-page-test', fn () => throw new TokenMismatchException)->middleware('web');
});

test('a button pressed after the sign-in ended goes to the sign-in page and then back to that page', function () {
    $this->withCookie(SignInExpiry::COOKIE, '1')
        ->withHeader('referer', url('/products/5/edit'))
        ->post('/expired-page-test')
        ->assertStatus(303)
        ->assertRedirect(route('login'))
        ->assertSessionHas('url.intended', url('/products/5/edit'))
        ->assertInertiaFlash('toast.message', SignInExpiry::EXPIRED_MESSAGE);
});

test('a button pressed on a page left open while still signed in shows the same page again', function () {
    $this->actingAs(User::factory()->specialist()->create())
        ->withCookie(SignInExpiry::COOKIE, '1')
        ->withHeader('referer', url('/orders'))
        ->post('/expired-page-test')
        ->assertStatus(303)
        ->assertRedirect(url('/orders'))
        ->assertInertiaFlash('toast.message', SignInExpiry::PAGE_REFRESHED_MESSAGE);
});

test('the sign-in page left open too long is shown again, ready to sign in', function () {
    $this->withHeader('referer', route('login'))
        ->post('/expired-page-test')
        ->assertRedirect(route('login'))
        ->assertInertiaFlash('toast.message', SignInExpiry::PAGE_REFRESHED_MESSAGE);
});

test('only a PROWARE page is ever the page to go back to', function () {
    $this->withCookie(SignInExpiry::COOKIE, '1')
        ->withHeader('referer', 'https://example.com/elsewhere')
        ->post('/expired-page-test')
        ->assertRedirect(route('login'))
        ->assertSessionHas('url.intended', route('home'));
});

test('the phone app keeps its plain 419 reply', function () {
    $this->postJson('/expired-page-test')->assertStatus(419);
});

test('opening a signed-in page after the sign-in ended says why on the sign-in page', function () {
    $this->withCookie(SignInExpiry::COOKIE, '1')
        ->get(route('dashboard'))
        ->assertRedirect(route('login'))
        ->assertInertiaFlash('toast.message', SignInExpiry::EXPIRED_MESSAGE);
});

test('a first visit to a signed-in page asks to sign in without saying anything expired', function () {
    $this->get(route('dashboard'))
        ->assertRedirect(route('login'))
        ->assertInertiaFlashMissing('toast');
});

test('signing in remembers it on the browser and signing out forgets it', function () {
    $user = User::factory()->specialist()->create();

    $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password'])
        ->assertCookie(SignInExpiry::COOKIE);

    $this->post(route('logout'))->assertCookieExpired(SignInExpiry::COOKIE);
});
