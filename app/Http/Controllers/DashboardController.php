<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Where signing in lands: the staff dashboard, or the storefront for a
 * student (students have no staff pages).
 */
class DashboardController extends Controller
{
    public function __invoke(Request $request): Response|RedirectResponse
    {
        if ($request->user()?->isStudent()) {
            return to_route('home');
        }

        return Inertia::render('dashboard');
    }
}
