<?php

namespace Tests\Feature\Settings;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class SecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_password_page_opens_without_asking_for_the_password_again()
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->get(route('security.edit'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('settings/security')
                ->has('passwordRules'),
            );
    }

    public function test_a_student_changes_the_password_on_the_my_account_page()
    {
        $student = User::factory()->student()->create();

        $this->actingAs($student)
            ->get(route('security.edit'))
            ->assertRedirect(route('profile.edit'));

        $this->actingAs($student)
            ->from(route('profile.edit'))
            ->put(route('user-password.update'), [
                'current_password' => 'password',
                'password' => 'New@Pass2026',
                'password_confirmation' => 'New@Pass2026',
            ])
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('profile.edit'))
            ->assertInertiaFlash('toast.message', 'Your password has been changed.');

        $this->assertTrue(Hash::check('New@Pass2026', $student->refresh()->password));
    }

    public function test_two_step_login_and_passkeys_are_not_offered()
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->get(route('security.edit'))
            ->assertInertia(fn (Assert $page) => $page
                ->missing('canManageTwoFactor')
                ->missing('canManagePasskeys')
                ->missing('passkeys'),
            );

        $this->assertFalse(Route::has('two-factor.enable'));
        $this->assertFalse(Route::has('passkeys.store'));
    }

    public function test_the_new_password_must_be_different_from_the_current_one()
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->from(route('security.edit'))
            ->put(route('user-password.update'), [
                'current_password' => 'password',
                'password' => 'password',
                'password_confirmation' => 'password',
            ])
            ->assertSessionHasErrors(['password' => 'The new password must be different from your current password.']);
    }

    public function test_password_can_be_updated()
    {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->from(route('security.edit'))
            ->put(route('user-password.update'), [
                'current_password' => 'password',
                'password' => 'New@Pass2026',
                'password_confirmation' => 'New@Pass2026',
            ]);

        $response
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('security.edit'))
            ->assertInertiaFlash('toast.message', 'Your password has been changed.');

        $this->assertTrue(Hash::check('New@Pass2026', $user->refresh()->password));
    }

    public function test_a_new_password_needs_a_symbol()
    {
        $user = User::factory()->create();

        $this
            ->actingAs($user)
            ->from(route('security.edit'))
            ->put(route('user-password.update'), [
                'current_password' => 'password',
                'password' => 'NewPass2026',
                'password_confirmation' => 'NewPass2026',
            ])
            ->assertSessionHasErrors(['password' => 'Your password must include at least one special character (e.g. ! @ # $).']);

        $this->assertTrue(Hash::check('password', $user->refresh()->password));
    }

    public function test_correct_password_must_be_provided_to_update_password()
    {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->from(route('security.edit'))
            ->put(route('user-password.update'), [
                'current_password' => 'wrong-password',
                'password' => 'new-password',
                'password_confirmation' => 'new-password',
            ]);

        $response
            ->assertSessionHasErrors(['current_password' => 'The current password is incorrect.'])
            ->assertRedirect(route('security.edit'));
    }

    public function test_too_many_tries_show_a_message_instead_of_an_error_page()
    {
        $user = User::factory()->create();
        $this->actingAs($user)->from(route('security.edit'));

        foreach (range(1, 6) as $try) {
            $this->put(route('user-password.update'), ['current_password' => 'wrong-password']);
        }

        $response = $this->put(route('user-password.update'), ['current_password' => 'wrong-password']);

        $response->assertRedirect(route('security.edit'));
        $response->assertSessionHasErrors('current_password');
        $this->assertMatchesRegularExpression(
            '/^Too many attempts\. Try again in \d+ seconds\.$/',
            $response->getSession()->get('errors')->getBag('default')->first('current_password'),
        );
    }
}
