<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Builds product photo links from the address the phone app used to reach
 * PROWARE (e.g. the laptop's Wi-Fi address), not from APP_URL, which a
 * phone may not be able to open (e.g. 127.0.0.1).
 */
class UseRequestHostForPhotos
{
    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        config(['filesystems.disks.public.url' => $request->getSchemeAndHttpHost().'/storage']);

        return $next($request);
    }
}
