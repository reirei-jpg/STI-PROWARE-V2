<?php

namespace App\Services\Auth;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cookie;
use Inertia\Inertia;

/**
 * What a user sees when their sign-in ended while PROWARE was open: the
 * sign-in page saying why, and after signing in, the page they were on.
 * A small cookie set at sign-in and removed at sign-out tells an ended
 * sign-in apart from a first visit.
 */
class SignInExpiry
{
    public const COOKIE = 'proware_signed_in';

    /** Longer than a sign-in lasts, so it outlives the session. */
    private const COOKIE_MINUTES = 60 * 24 * 30;

    public const EXPIRED_MESSAGE = 'Your sign-in expired after a while without activity. Sign in again to go back to where you were.';

    public const PAGE_REFRESHED_MESSAGE = 'This page was open for a long time, so it was refreshed. Press the button again.';

    public static function markSignedIn(): void
    {
        Cookie::queue(self::COOKIE, '1', self::COOKIE_MINUTES);
    }

    public static function markSignedOut(): void
    {
        Cookie::queue(Cookie::forget(self::COOKIE));
    }

    /**
     * Where a visitor who is not signed in is sent from a signed-in page,
     * saying so when their sign-in expired.
     */
    public static function signInPageFor(Request $request): string
    {
        if (self::wasSignedIn($request)) {
            Inertia::flash('toast', ['type' => 'warning', 'message' => self::EXPIRED_MESSAGE]);
        }

        return route('login');
    }

    /**
     * A button pressed on a page left open too long (419 Page Expired):
     * signed out meanwhile, the sign-in page and then back to that page;
     * still signed in, the same page again, ready to press the button again.
     */
    public static function expiredPageResponse(Request $request): RedirectResponse
    {
        $previous = self::previousPage($request);

        if ($request->user() === null && self::wasSignedIn($request)) {
            redirect()->setIntendedUrl($previous);
            Inertia::flash('toast', ['type' => 'warning', 'message' => self::EXPIRED_MESSAGE]);

            return redirect()->route('login', status: 303);
        }

        Inertia::flash('toast', ['type' => 'warning', 'message' => self::PAGE_REFRESHED_MESSAGE]);

        return redirect()->to($previous, 303);
    }

    private static function wasSignedIn(Request $request): bool
    {
        return $request->cookie(self::COOKIE) !== null;
    }

    /** The page the button was on, only ever a PROWARE page. */
    private static function previousPage(Request $request): string
    {
        $previous = (string) $request->headers->get('referer', '');

        return str_starts_with($previous, url('/').'/') || $previous === url('/')
            ? $previous
            : route('home');
    }
}
