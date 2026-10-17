<?php

namespace Tests\Feature\Settings;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProfileUpdateTest extends TestCase
{
    use RefreshDatabase;

    public function test_profile_page_is_displayed()
    {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->get(route('profile.edit'));

        $response->assertOk();
    }

    public function test_the_name_can_be_changed()
    {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->patch(route('profile.update'), [
                'name' => 'Test User',
            ]);

        $response
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('profile.edit'))
            ->assertInertiaFlash('toast.message', 'Your profile has been updated.');

        $this->assertSame('Test User', $user->refresh()->name);
    }

    public function test_an_empty_name_is_refused()
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->patch(route('profile.update'), ['name' => ''])
            ->assertSessionHasErrors(['name' => 'Enter your name.']);

        $this->assertNotSame('', $user->refresh()->name);
    }

    public function test_a_name_with_numbers_or_symbols_is_refused()
    {
        $user = User::factory()->create(['name' => 'Carlo Mendoza']);

        foreach (['Carlo123', 'Carlo_Mendoza', '-Carlo'] as $name) {
            $this->actingAs($user)
                ->patch(route('profile.update'), ['name' => $name])
                ->assertSessionHasErrors(['name' => 'The name may only contain letters, spaces, periods, hyphens and apostrophes.']);
        }

        $this->assertSame('Carlo Mendoza', $user->refresh()->name);
    }

    public function test_a_name_with_n_tilde_periods_hyphens_and_apostrophes_is_accepted()
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->patch(route('profile.update'), ['name' => "Ma. Niña O'Neil-Dela Cruz"])
            ->assertSessionHasNoErrors();

        $this->assertSame("Ma. Niña O'Neil-Dela Cruz", $user->refresh()->name);
    }

    public function test_the_email_cannot_be_changed_here_so_the_account_stays_verified()
    {
        $user = User::factory()->create();
        $email = $user->email;

        $this->actingAs($user)
            ->patch(route('profile.update'), [
                'name' => 'Test User',
                'email' => 'someone.else@example.com',
            ])
            ->assertSessionHasNoErrors();

        $user->refresh();
        $this->assertSame($email, $user->email);
        $this->assertNotNull($user->email_verified_at);
    }

    public function test_staff_accounts_cannot_be_deleted_from_settings()
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->delete('/settings/profile', ['password' => 'password'])
            ->assertMethodNotAllowed();

        $this->assertNotNull($user->fresh());
        $this->assertAuthenticatedAs($user);
    }
}
