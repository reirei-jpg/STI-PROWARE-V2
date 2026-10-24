<?php

namespace App\Providers;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use Inertia\ExceptionResponse;
use Inertia\Inertia;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
        $this->configureErrorPages();
        $this->configureRouteIds();
    }

    /**
     * Record ids in addresses are numbers only, so an address like
     * /merchandise/12x is "not found" instead of a database error
     * (PostgreSQL refuses letters in a number column).
     */
    protected function configureRouteIds(): void
    {
        foreach (['cartItem', 'order', 'preorder', 'product', 'purchaseOrder', 'student', 'uniformSet', 'variant'] as $parameter) {
            Route::pattern($parameter, '[0-9]+');
        }
    }

    /**
     * PROWARE's own error page instead of the server's bare one ("403
     * Forbidden"), with a way back. Not found and not allowed always; server
     * errors and maintenance only outside development, so errors stay
     * visible while building. JSON callers (the phone app, popups loading
     * details) keep their plain error replies.
     */
    protected function configureErrorPages(): void
    {
        Inertia::handleExceptionsUsing(function (ExceptionResponse $response) {
            $request = $response->request;
            $status = $response->statusCode();
            $friendly = in_array($status, [403, 404], true)
                || (in_array($status, [500, 503], true) && ! app()->environment(['local', 'testing']));

            if (! $friendly || ($request->expectsJson() && ! $request->hasHeader('X-Inertia'))) {
                return null;
            }

            return $response->render('error', ['status' => $status])->withSharedData();
        });
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        // V1's password rule, the same when registering, resetting and changing it.
        Password::defaults(fn (): Password => Password::min(8)
            ->letters()
            ->numbers()
            ->symbols(),
        );
    }
}
