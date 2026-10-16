<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Services\Dashboard\SchoolAdminOverview;
use App\Services\Dashboard\SpecialistTasks;
use App\Services\Shop\SpecialistOrders;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Where signing in lands: the staff dashboard, or the storefront for a
 * student (students have no staff pages). The Specialist's dashboard has
 * the student order cards and a to-do list for today; the School Admin's
 * monitors purchase orders and deliveries.
 */
class DashboardController extends Controller
{
    public function __invoke(Request $request, SpecialistTasks $tasks, SchoolAdminOverview $overview): Response|RedirectResponse
    {
        $user = $request->user();

        if ($user?->isStudent()) {
            return to_route('home');
        }

        return Inertia::render('dashboard', [
            'tasks' => $user?->role === UserRole::Specialist ? $tasks->all(withOrders: false) : null,
            'orderCards' => $user?->role === UserRole::Specialist ? SpecialistOrders::dashboardCards() : null,
            'overview' => $user?->role === UserRole::SchoolAdmin ? $overview->all() : null,
        ]);
    }
}
