<?php

namespace App\Providers;

use App\Actions\Fortify\CreateNewUser;
use App\Actions\Fortify\ResetUserPassword;
use App\Http\Requests\LoginRequest;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Lang;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Laravel\Fortify\Features;
use Laravel\Fortify\Fortify;
use Laravel\Fortify\Http\Requests\LoginRequest as FortifyLoginRequest;

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
        // After 5 tries in a minute: a message on the form with how long to
        // wait, not the bare "429 Too Many Requests" page.
        RateLimiter::for('login', function (Request $request) {
            $throttleKey = Str::transliterate(Str::lower($request->input(Fortify::username())).'|'.$request->ip());

            return Limit::perMinute(5)->by($throttleKey)->response(
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
