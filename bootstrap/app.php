<?php

use App\Http\Middleware\EnsureUserHasRole;
use App\Http\Middleware\HandleInertiaRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'role' => EnsureUserHasRole::class,
        ]);

        $middleware->web(append: [
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // A list page opened straight from its address (a bookmark, an old
        // link or a typed address) with a wrong filter opens that page
        // without its filters and says what was wrong, instead of quietly
        // going back to whatever page was open before. Filters changed on
        // the page itself (Inertia visits) keep going back as usual.
        $exceptions->render(function (ValidationException $exception, Request $request) {
            $routeName = (string) $request->route()?->getName();
            $isListPage = str_ends_with($routeName, '.index') || in_array($routeName, ['home', 'products.stock', 'orders.slip'], true);

            if (! $isListPage || ! $request->isMethod('GET') || $request->expectsJson() || $request->hasHeader('X-Inertia')) {
                return null;
            }

            Inertia::flash('toast', [
                'type' => 'error',
                'message' => collect($exception->errors())->flatten()->first().' The list is shown without its filters.',
            ]);

            return redirect()->to($request->url())->withErrors($exception->errors(), $exception->errorBag);
        });
    })->create();
