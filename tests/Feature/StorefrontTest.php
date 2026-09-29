<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('anyone can browse the storefront without signing in', function () {
    $this->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('storefront/home')
            ->where('auth.user', null)
        );
});

test('signed-in staff can also open the storefront', function () {
    $this->actingAs(User::factory()->specialist()->create())
        ->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('storefront/home'));
});
