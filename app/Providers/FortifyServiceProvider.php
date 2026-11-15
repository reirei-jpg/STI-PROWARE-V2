<?php

namespace App\Providers;

use App\Actions\Fortify\CreateNewUser;
use App\Actions\Fortify\ResetUserPassword;
use App\Http\Requests\ForgotPasswordRequest;
use App\Http\Requests\LoginRequest;
use App\Http\Responses\PasswordResetLinkResponse;
use App\Models\User;
use App\Services\Auth\SignInLock;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Lang;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Laravel\Fortify\Contracts\FailedPasswordResetLinkRequestResponse;
use Laravel\Fortify\Contracts\SuccessfulPasswordResetLinkRequestResponse;
use Laravel\Fortify\Features;
use Laravel\Fortify\Fortify;
use Laravel\Fortify\Http\Requests\LoginRequest as FortifyLoginRequest;
use Laravel\Fortify\Http\Requests\SendPasswordResetLinkRequest;

class FortifyServiceProvider extends ServiceProvider
{
    /** A wrong email or password, on the website and the phone app. */
    public const FAILED_LOGIN = 'These credentials do not match our records. Check the email and password.';

    /**
     * Register any application services.
     */
    public function register(): void
    {
        // The login form with PROWARE's words for empty boxes.
        $this->app->bind(FortifyLoginRequest::class, LoginRequest::class);

        // Forgot password: PROWARE's words, and the same answer whether or not
        // the email has an account.
        $this->app->bind(SendPasswordResetLinkRequest::class, ForgotPasswordRequest::class);
        $this->app->bind(SuccessfulPasswordResetLinkRequestResponse::class, PasswordResetLinkResponse::class);
        $this->app->bind(FailedPasswordResetLinkRequestResponse::class, PasswordResetLinkResponse::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureActions();
        $this->configureViews();
        $this->configureRateLimiting();

        // A wrong email or password (Fortify reads auth.failed).
        Lang::addLines(['auth.failed' => self::FAILED_LOGIN], 'en');
    }

    /**
     * Configure Fortify actions.
     */
    private function configureActions(): void
    {
        Fortify::resetUserPasswordsUsing(ResetUserPassword::class);
        Fortify::createUsersUsing(CreateNewUser::class);

        // Signing in on the website, with the same lock as the phone app
        // (SignInLock): a locked account is refused even with the right
        // password; a wrong one is counted, and the 5th in a row locks it.
        Fortify::authenticateUsing(function (Request $request): ?User {
            $user = User::query()->where('email', Str::lower(trim((string) $request->input(Fortify::username()))))->first();

            if ($user === null) {
                return null;
            }

            $refusal = SignInLock::refusal($user);

            if ($refusal !== null) {
                throw ValidationException::withMessages([Fortify::username() => $refusal]);
            }

            if (! Hash::check((string) $request->input('password'), $user->password)) {
                $locked = SignInLock::wrongPassword($user);

                if ($locked !== null) {
                    throw ValidationException::withMessages([Fortify::username() => $locked]);
                }

                return null;
            }

            SignInLock::clear($user);

            return $user;
        });
    }

    /**
     * Configure Fortify views.
     */
    private function configureViews(): void
    {
        Fortify::loginView(fn (Request $request) => Inertia::render('auth/login', [
            'canResetPassword' => Features::enabled(Features::resetPasswords()),
            'status' => $request->session()->get('status'),
        ]));

        Fortify::resetPasswordView(fn (Request $request) => Inertia::render('auth/reset-password', [
            'email' => $request->email,
            'token' => $request->route('token'),
            'passwordRules' => Password::defaults()->toPasswordRulesString(),
        ]));

        Fortify::requestPasswordResetLinkView(fn (Request $request) => Inertia::render('auth/forgot-password', [
            'status' => $request->session()->get('status'),
        ]));

        Fortify::verifyEmailView(fn (Request $request) => Inertia::render('auth/verify-email', [
            'status' => $request->session()->get('status'),
        ]));

        Fortify::registerView(fn () => Inertia::render('auth/register'));

        Fortify::confirmPasswordView(fn () => Inertia::render('auth/confirm-password'));
    }

    /**
     * Configure rate limiting.
     */
    private function configureRateLimiting(): void
    {
        // After 10 tries in a minute: a message on the form with how long to
        // wait, not the bare "429 Too Many Requests" page. Higher than the 5
        // wrong passwords that lock an account (SignInLock), so someone
        // mistyping always sees the lock's message first; this only stops
        // rapid, automated tries.
        RateLimiter::for('login', function (Request $request) {
            $throttleKey = Str::transliterate(Str::lower($request->input(Fortify::username())).'|'.$request->ip());

            return Limit::perMinute(10)->by($throttleKey)->response(
                fn (Request $request, array $headers) => back()
                    ->withErrors([Fortify::username() => 'Too many login attempts. Try again in '.max(1, (int) ($headers['Retry-After'] ?? 60)).' seconds.'])
                    ->onlyInput(Fortify::username()),
            );
        });

        // Changing a password: 6 tries a minute, then a message on the form
        // instead of a bare "429 Too Many Requests" page.
        RateLimiter::for('password-update', fn (Request $request) => Limit::perMinute(6)
            ->by('password-update|'.$request->user()?->id)
            ->response(fn (Request $request, array $headers) => back()->withErrors([
                'current_password' => 'Too many attempts. Try again in '.max(1, (int) ($headers['Retry-After'] ?? 60)).' seconds.',
            ])));
    }
}
