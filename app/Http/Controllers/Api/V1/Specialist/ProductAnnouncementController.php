<?php

namespace App\Http\Controllers\Api\V1\Specialist;

use App\Http\Controllers\Controller;
use App\Http\Requests\AnnounceProductRequest;
use App\Services\Dashboard\TopBuyers;
use Illuminate\Http\JsonResponse;

/**
 * Tell the top buyers about a product from the phone's Top buyers card, as
 * on the website (TopBuyers).
 */
class ProductAnnouncementController extends Controller
{
    public function store(AnnounceProductRequest $request): JsonResponse
    {
        return response()->json([
            'message' => TopBuyers::announce($request->product(), $request->integer('top'), $request->input('note'), $request->user()),
        ]);
    }
}
