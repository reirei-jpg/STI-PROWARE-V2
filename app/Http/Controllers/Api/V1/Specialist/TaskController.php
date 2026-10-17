<?php

namespace App\Http\Controllers\Api\V1\Specialist;

use App\Http\Controllers\Controller;
use App\Services\Dashboard\SpecialistTasks;
use App\Services\Shop\SpecialistOrders;
use Illuminate\Http\JsonResponse;

/**
 * The Specialist's To-do on the phone, the same as the website dashboard:
 * the student order cards (New, Ready for pickup, Last day today, Released
 * today) and the Do now / Today / This week tasks. Each task says which
 * phone screen opens it, or that it is done on the website.
 */
class TaskController extends Controller
{
    public function __invoke(SpecialistTasks $tasks): JsonResponse
    {
        return response()->json([
            ...$tasks->all(),
            'order_cards' => SpecialistOrders::dashboardCards(),
        ]);
    }
}
