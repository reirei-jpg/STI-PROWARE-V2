<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Preorders\CancelPreorderByStudent;
use App\Actions\Preorders\PlacePreorder;
use App\Http\Controllers\Controller;
use App\Http\Requests\PlacePreorderRequest;
use App\Models\Preorder;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The student's preorders on the phone app (reservations, nothing to pay),
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
        return response()->json($request->user()->preorders()
            ->with(['product.mainPhoto', 'variant'])
            ->orderByRaw("case when status = 'active' then 0 else 1 end")
            ->latest('id')
            ->paginate(20)
            ->through(fn (Preorder $preorder): array => CancelPreorderByStudent::row($preorder)));
    }

    public function store(PlacePreorderRequest $request, Product $product, PlacePreorder $placePreorder): JsonResponse
    {
        $preorder = $placePreorder->handle($request->user(), $product, $request->integer('product_variant_id'), $request->integer('quantity'));

        return response()->json([
            'message' => PlacePreorder::message($preorder, $product),
            'preorder' => CancelPreorderByStudent::row($preorder->load(['product.mainPhoto', 'variant'])),
        ], 201);
    }

    public function destroy(Request $request, Preorder $preorder, CancelPreorderByStudent $cancelPreorder): JsonResponse
    {
        abort_unless($preorder->user_id === $request->user()->id, 404);

        $cancelPreorder->handle($preorder);

        return response()->json([
            'message' => "Your preorder for {$preorder->product->name} was cancelled.",
            'preorder' => CancelPreorderByStudent::row($preorder->refresh()->load(['product.mainPhoto', 'variant'])),
        ]);
    }
}
