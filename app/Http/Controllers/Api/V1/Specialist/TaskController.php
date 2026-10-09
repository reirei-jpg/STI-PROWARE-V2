<?php

namespace App\Http\Controllers\Api\V1\Specialist;

use App\Http\Controllers\Controller;
use App\Services\Dashboard\SpecialistTasks;
use Illuminate\Http\JsonResponse;

/**
 * The Specialist's to-do list on the phone: the website dashboard's Do now
 * / Today / This week (SpecialistTasks). Each task
 * says which phone screen opens it, or that it is done on the website.
 */
class TaskController extends Controller
{
    public function __invoke(SpecialistTasks $tasks): JsonResponse
    {
        return response()->json($tasks->all());
    }
}
