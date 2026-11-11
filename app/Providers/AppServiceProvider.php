<?php

namespace App\Providers;

use App\Services\Auth\SignInExpiry;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Logout;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
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
        $this->configurePastTheEndPages();
    }

    /**
     * A list page opened at a page past its last one (an old link, a typed
     * address, or the last item of the last page gone) opens the last page
     * instead of saying the list is empty. Every list's page comes from the
     * query's paginate(), which makes its paginator here. The phone app and
     * popups loading data (JSON) keep the plain empty page they ask for.
     */
    protected function configurePastTheEndPages(): void
    {
        $this->app->bind(LengthAwarePaginator::class, function ($app, array $parameters): LengthAwarePaginator {
            $paginator = new LengthAwarePaginator(
                $parameters['items'],
                $parameters['total'],
                $parameters['perPage'],
                $parameters['currentPage'] ?? null,
                $parameters['options'] ?? [],
            );

            $request = request();
            $isPage = $request->isMethod('GET') && ! $request->is('api/*') && (! $request->expectsJson() || $request->hasHeader('X-Inertia'));

            if ($isPage && $paginator->total() > 0 && $paginator->currentPage() > $paginator->lastPage()) {
                throw new HttpResponseException(redirect()->to(
                    $request->fullUrlWithQuery([$paginator->getPageName() => $paginator->lastPage()]),
                ));
            }

            return $paginator;
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
        $this->configureErrorPages();
        $this->configureRouteIds();
        $this->configureSignInMarker();
    }

    /**
     * Remember on this browser that someone was signed in, so an expired
     * sign-in is explained on the sign-in page (see SignInExpiry).
     */
    protected function configureSignInMarker(): void
    {
        Event::listen(Login::class, fn () => SignInExpiry::markSignedIn());
        Event::listen(Logout::class, fn () => SignInExpiry::markSignedOut());
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
     * visible while building. A page left open too long (419 Page Expired)
     * goes to the sign-in page or back to the same page with a message
     * instead. JSON callers (the phone app, popups loading details) keep
     * their plain error replies.
     */
    protected function configureErrorPages(): void
    {
        Inertia::handleExceptionsUsing(function (ExceptionResponse $response) {
            $request = $response->request;
            $status = $response->statusCode();

            if ($status === 419 && (! $request->expectsJson() || $request->hasHeader('X-Inertia'))) {
                return SignInExpiry::expiredPageResponse($request);
            }

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
