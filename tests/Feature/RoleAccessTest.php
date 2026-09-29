<?php

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Support\Facades\Route;

beforeEach(function () {
    Route::middleware(['web', 'auth', 'role:specialist'])
        ->get('/_test/specialist-only', fn () => 'ok');

    Route::middleware(['web', 'auth', 'role:specialist,school_admin'])
        ->get('/_test/any-staff', fn () => 'ok');
});

test('a specialist can open a specialist-only page', function () {
    $this->actingAs(User::factory()->specialist()->create())
        ->get('/_test/specialist-only')
        ->assertOk();
});

test('a school admin is blocked from a specialist-only page', function () {
    $this->actingAs(User::factory()->schoolAdmin()->create())
        ->get('/_test/specialist-only')
        ->assertForbidden();
});

test('a page open to several roles lets each of them in', function (UserRole $role) {
    $this->actingAs(User::factory()->create(['role' => $role]))
        ->get('/_test/any-staff')
        ->assertOk();
})->with([UserRole::Specialist, UserRole::SchoolAdmin]);

test('public registration is turned off', function () {
    $this->get('/register')->assertNotFound();
});

test('the seeder creates the two demo staff accounts with their roles', function () {
    $this->seed();

    expect(User::query()->where('email', 'carlo.mendoza.emp0157@proware.sti.edu.ph')->first()->role)
        ->toBe(UserRole::Specialist)
        ->and(User::query()->where('email', 'liza.garcia.adm2026@proware.sti.edu.ph')->first()->role)
        ->toBe(UserRole::SchoolAdmin);
});
