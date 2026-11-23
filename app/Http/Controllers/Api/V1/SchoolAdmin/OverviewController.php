<?php

namespace App\Http\Controllers\Api\V1\SchoolAdmin;

use App\Actions\PurchaseOrders\RemindSpecialist;
use App\Http\Controllers\Controller;
use App\Http\Requests\FilterAdminDashboardRequest;
use App\Models\PurchaseOrder;
use App\Services\Auth\SignInLock;
use App\Services\Dashboard\SchoolAdminOverview;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The School Admin on the phone, view only like the website's dashboard:
 * the eStore orders by what has arrived (Awaiting Delivery, Partially
 * Received, Completed) with a search by Order #, what sells, and the staff
 * accounts locked after wrong passwords. The only actions are Remind
 * Specialist about a late order and Unlock (LockedAccountController).
 */
class OverviewController extends Controller
{
    /**
     * The website's School Admin dashboard data (SchoolAdminOverview).
     */
    public function index(FilterAdminDashboardRequest $request, SchoolAdminOverview $overview): JsonResponse
    {
        return response()->json([
            ...$overview->all($request->tab(), $request->search(), $request->period()),
            'locked_accounts' => SignInLock::lockedFor($request->user()),
        ]);
    }

    /**
     * Remind the Specialist about a late eStore order (once a week).
     */
    public function remind(Request $request, PurchaseOrder $purchaseOrder, RemindSpecialist $remind): JsonResponse
    {
        return response()->json([
            'message' => $remind->handle($purchaseOrder, $request->user()),
            ...SchoolAdminOverview::reminder($purchaseOrder->refresh()->load('reminder')),
        ]);
    }
}
