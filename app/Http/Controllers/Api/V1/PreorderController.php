<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Preorders\CancelPreorderByStudent;
use App\Actions\Preorders\EditPreorderByStudent;
use App\Actions\Preorders\PlacePreorder;
use App\Http\Controllers\Controller;
use App\Http\Requests\EditPreorderRequest;
use App\Http\Requests\PlacePreorderRequest;
use App\Models\Preorder;
use App\Models\PreorderSlip;
use App\Models\Product;
use App\Services\Preorders\PreorderPayment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The student's preorders on the phone app (paid at the cashier with a preorder slip),
 * with the website's rules (PlacePreorderRequest, PlacePreorder,
 * CancelPreorderByStudent).
 */
class PreorderController extends Controller
{
    /**
     * Active preorders first, newest first, 20 at a time.
     */
    public function index(Request $request): JsonResponse
    {
        return response()->json(CancelPreorderByStudent::studentPage($request->user()));
    }

    /**
     * The preorder slip, as on the website.
     */
    public function slip(Request $request, PreorderSlip $preorderSlip): JsonResponse
    {
        abort_unless($preorderSlip->user_id === $request->user()->id, 404);

        return response()->json(PreorderPayment::view($preorderSlip));
    }

    public function store(PlacePreorderRequest $request, Product $product, PlacePreorder $placePreorder): JsonResponse
    {
        $preorders = $placePreorder->handleMany($request->user(), $product, $request->items());
        $rows = array_map(
            fn (Preorder $preorder): array => CancelPreorderByStudent::row($preorder->load(['product.mainPhoto', 'variant'])),
            $preorders,
        );

        return response()->json([
            'message' => PlacePreorder::messageForMany($preorders, $product),
            'preorder' => $rows[0],
            'preorders' => $rows,
        ], 201);
    }

    /**
     * Change the size, color or quantity of a waiting preorder (as on the website).
     */
    public function update(EditPreorderRequest $request, Preorder $preorder, EditPreorderByStudent $editPreorder): JsonResponse
    {
        $moved = $editPreorder->handle($preorder, $request->variant(), $request->integer('quantity'));

        return response()->json([
            'message' => EditPreorderByStudent::message($preorder, $moved),
            'preorder' => CancelPreorderByStudent::row($preorder->refresh()->load(['product.mainPhoto', 'variant', 'order'])),
        ]);
    }

    public function destroy(Request $request, Preorder $preorder, CancelPreorderByStudent $cancelPreorder): JsonResponse
    {
        abort_unless($preorder->user_id === $request->user()->id, 404);

        $cancelPreorder->handle($preorder);

        return response()->json([
            'message' => CancelPreorderByStudent::message($preorder),
            'preorder' => CancelPreorderByStudent::row($preorder->refresh()->load(['product.mainPhoto', 'variant'])),
        ]);
    }
}
