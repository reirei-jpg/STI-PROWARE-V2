<?php

use App\Models\AccountLock;
use App\Models\User;
use App\Notifications\AccountLocked;
use App\Notifications\AccountLockedForStaff;
use App\Notifications\PhoneSignedIn;
use App\Services\Auth\SignInLock;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-11-15 14:30', 'Asia/Manila'));
    $this->buyer = User::factory()->student()->create(['name' => 'Juan Dela Cruz', 'email' => 'delacruz.123456@sti.edu.ph']);
    $this->specialist = User::factory()->specialist()->create(['name' => 'Carlo Mendoza']);
    $this->schoolAdmin = User::factory()->schoolAdmin()->create(['name' => 'Liza Garcia']);
});

/**
 * 5 wrong passwords in a row on the website: the account locks.
 */
function lockOut(User $user): void
{
    // The sign-in page is for someone signed out.
    auth()->logout();

    foreach (range(1, SignInLock::MAX_WRONG_PASSWORDS) as $try) {
        test()->post(route('login.store'), ['email' => $user->email, 'password' => 'Wrong@2026!']);
    }

    expect(SignInLock::isLocked($user->refresh()))->toBeTrue();
}

test('a lock tells the owner and the Specialist; the third lock in a day warns of guessing', function () {
    Notification::fake();

    lockOut($this->buyer);

    Notification::assertSentTo($this->buyer, AccountLocked::class, fn (AccountLocked $notice) => $notice->toPush($this->buyer)['body']
        === '5 wrong passwords were typed for your account, so it is locked until 2:45 PM. If this was not you, change your password.');
    Notification::assertSentTo($this->specialist, AccountLockedForStaff::class, fn (AccountLockedForStaff $notice) => $notice->toPush($this->specialist) === [
        'title' => 'Account locked: Juan Dela Cruz',
        'body' => '5 wrong passwords in a row. Locked until 2:45 PM.',
        'data' => ['kind' => 'account_locked_staff', 'user_id' => $this->buyer->id],
    ]);
    // The School Admin is not told about buyers.
    Notification::assertNotSentTo($this->schoolAdmin, AccountLockedForStaff::class);

    $this->travel(16)->minutes();
    lockOut($this->buyer);
    $this->travel(16)->minutes();
    lockOut($this->buyer);

    expect(AccountLock::query()->where('user_id', $this->buyer->id)->count())->toBe(3);
    Notification::assertSentTo($this->specialist, AccountLockedForStaff::class, fn (AccountLockedForStaff $notice) => $notice->locksToday === 3
        && str_ends_with($notice->toPush($this->specialist)['body'], 'Locked 3 times today: someone may be guessing the password.'));
});

test('the Specialist sees locked buyers on Maintenance and unlocks one at once', function () {
    lockOut($this->buyer);
    auth()->logout();

    $this->actingAs($this->specialist)->get(route('maintenance.index'))->assertInertia(fn (Assert $page) => $page
        ->has('lockedAccounts', 1)
        ->where('lockedAccounts.0.name', 'Juan Dela Cruz')
        ->where('lockedAccounts.0.locks_today', 1));

    $this->post(route('locked-accounts.unlock', $this->buyer))
        ->assertInertiaFlash('toast.message', "Juan Dela Cruz's account has been unlocked. They can sign in now.");
    expect(AccountLock::sole())->unlocked_by->toBe($this->specialist->id);

    // Already unlocked: said so, nothing else happens.
    $this->post(route('locked-accounts.unlock', $this->buyer))
        ->assertInertiaFlash('toast.message', "Juan Dela Cruz's account is not locked any more. They can sign in now.");

    auth()->logout();
    $this->post(route('login.store'), ['email' => $this->buyer->email, 'password' => 'password'])->assertSessionHasNoErrors();
    $this->assertAuthenticatedAs($this->buyer);
});

test('the School Admin unlocks the Specialist, and nobody unlocks an account that is not theirs to unlock', function () {
    Notification::fake();
    lockOut($this->specialist);
    auth()->logout();

    Notification::assertSentTo($this->schoolAdmin, AccountLockedForStaff::class);
    Notification::assertNotSentTo($this->specialist, AccountLockedForStaff::class);

    $this->actingAs($this->schoolAdmin)->get(route('dashboard'))->assertInertia(fn (Assert $page) => $page
        ->where('lockedAccounts.0.name', 'Carlo Mendoza'));

    // The School Admin does not unlock buyers.
    lockOut($this->buyer);
    auth()->logout();
    $this->actingAs($this->schoolAdmin)->post(route('locked-accounts.unlock', $this->buyer))->assertForbidden();

    $this->post(route('locked-accounts.unlock', $this->specialist))
        ->assertInertiaFlash('toast.message', "Carlo Mendoza's account has been unlocked. They can sign in now.");

    // The Specialist does not unlock another staff account, and a buyer unlocks nobody.
    lockOut($this->schoolAdmin);
    auth()->logout();
    $this->actingAs($this->specialist)->post(route('locked-accounts.unlock', $this->schoolAdmin))->assertForbidden();
    $this->actingAs(User::factory()->student()->create())->post(route('locked-accounts.unlock', $this->buyer))->assertForbidden();
});

test('the Specialist unlocks a buyer from the phone app', function () {
    lockOut($this->buyer);
    auth()->logout();
    Sanctum::actingAs($this->specialist);

    $this->postJson(route('api.v1.specialist.locked-accounts.unlock', $this->buyer))
        ->assertOk()
        ->assertJson(['unlocked' => true, 'message' => "Juan Dela Cruz's account has been unlocked. They can sign in now."]);

    Sanctum::actingAs($this->buyer);
    $this->postJson(route('api.v1.specialist.locked-accounts.unlock', $this->buyer))->assertForbidden();
});

test('Forgot password says the same whether or not the email has an account', function () {
    $message = 'If that email has a PROWARE account, a link to set a new password has been sent to it.';

    $this->post(route('password.email'), ['email' => 'nobody.999999@sti.edu.ph'])->assertSessionHas('status', $message);
    $this->post(route('password.email'), ['email' => $this->buyer->email])->assertSessionHas('status', $message);
    // Asked again a moment later (the link is not sent twice): still the same.
    $this->post(route('password.email'), ['email' => $this->buyer->email])->assertSessionHas('status', $message);

    $this->post(route('password.email'), ['email' => ''])->assertSessionHasErrors(['email' => 'Enter your email address.']);
    $this->post(route('password.email'), ['email' => 'juan'])->assertSessionHasErrors(['email' => 'Enter a valid email address, e.g. delacruz.123456@sti.edu.ph.']);
});

test('a new password signs the account out on every other browser and phone', function () {
    $this->buyer->createToken('Pixel 8');
    $this->buyer->forceFill(['remember_token' => 'old-remember-token'])->save();
    DB::table('sessions')->insert([
        ['id' => 'other-browser', 'user_id' => $this->buyer->id, 'ip_address' => '10.0.0.2', 'user_agent' => 'Chrome', 'payload' => '', 'last_activity' => now()->timestamp],
        ['id' => 'someone-else', 'user_id' => $this->specialist->id, 'ip_address' => '10.0.0.3', 'user_agent' => 'Chrome', 'payload' => '', 'last_activity' => now()->timestamp],
    ]);

    $this->actingAs($this->buyer)
        ->put(route('user-password.update'), ['current_password' => 'password', 'password' => 'NewPass@2026!', 'password_confirmation' => 'NewPass@2026!'])
        ->assertSessionHasNoErrors();

    expect($this->buyer->refresh()->tokens()->count())->toBe(0)
        ->and($this->buyer->remember_token)->not->toBe('old-remember-token')
        ->and(DB::table('sessions')->where('id', 'other-browser')->exists())->toBeFalse()
        // Other accounts are not touched.
        ->and(DB::table('sessions')->where('id', 'someone-else')->exists())->toBeTrue();
});

test('signing in on a phone tells the owner, so a sign-in that was not them is noticed', function () {
    Notification::fake();

    $this->postJson(route('api.v1.auth.login'), ['email' => $this->buyer->email, 'password' => 'password', 'device_name' => 'Pixel 8'])->assertOk();

    Notification::assertSentTo($this->buyer, PhoneSignedIn::class, fn (PhoneSignedIn $notice) => $notice->toPush($this->buyer)['body']
        === 'Your account was signed in on a phone (Pixel 8) on Nov 15, 2:30 PM. If this was not you, change your password.');

    // A wrong password signs nobody in: nothing is said.
    $this->postJson(route('api.v1.auth.login'), ['email' => $this->specialist->email, 'password' => 'Wrong@2026!', 'device_name' => 'Pixel 8'])->assertUnprocessable();
    Notification::assertNotSentTo($this->specialist, PhoneSignedIn::class);
});

test('opening a sign-in notice shows the password page; a lock notice shows where to unlock', function () {
    $this->buyer->notify(new AccountLocked(now()->addMinutes(15)));
    $this->specialist->notify(new AccountLockedForStaff($this->buyer, now()->addMinutes(15), 1));

    $this->actingAs($this->buyer)->post(route('notifications.open', $this->buyer->notifications()->sole()->id))->assertRedirect(route('security.edit'));
    $this->actingAs($this->specialist)->post(route('notifications.open', $this->specialist->notifications()->sole()->id))->assertRedirect(route('maintenance.index'));
});
