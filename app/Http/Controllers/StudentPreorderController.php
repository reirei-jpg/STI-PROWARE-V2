<?php

namespace App\Http\Controllers;

use App\Actions\Preorders\CancelPreorderByStudent;
use App\Actions\Preorders\PlacePreorder;
use App\Http\Requests\PlacePreorderRequest;
use App\Models\Preorder;
use App\Models\Product;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * A student's preorders: reservations of Preorder products (no payment)
 * that tell the Specialist how many to order in the eStore.
 */
class StudentPreorderController extends Controller
{
    /**
     * My Preorders: the student's preorders, active ones first, newest first.
     */
    public function index(Request $request): Response
    {
        $preorders = $request->user()->preorders()
            ->with(['product.mainPhoto', 'variant'])
            ->orderByRaw("case when status = 'active' then 0 else 1 end")
            ->latest('id')
            ->paginate(20)
            ->withQueryString()
            ->through(fn (Preorder $preorder): array => CancelPreorderByStudent::row($preorder));

        return Inertia::render('storefront/my-preorders', [
            'preorders' => $preorders,
        ]);
    }

    /**
     * Preorder a size or color. Preordering the same one again changes how
     * many, so a student has one preorder per size or color.
     */
    public function store(PlacePreorderRequest $request, Product $product, PlacePreorder $placePreorder): RedirectResponse
    {
        $preorder = $placePreorder->handle($request->user(), $product, $request->integer('product_variant_id'), $request->integer('quantity'));

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => PlacePreorder::message($preorder, $product),
        ]);

        return back();
    }

    /**
     * Cancel a preorder, while preorders for the product are still open.
     */
    public function destroy(Request $request, Preorder $preorder, CancelPreorderByStudent $cancelPreorder): RedirectResponse
    {
        abort_unless($preorder->user_id === $request->user()->id, 404);

        $product = $preorder->product;
        $refusal = CancelPreorderByStudent::refusal($preorder);

        if ($refusal !== null) {
            Inertia::flash('toast', ['type' => 'error', 'message' => $refusal]);

            return back();
        }

        $cancelPreorder->handle($preorder);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => "Your preorder for {$product->name} was cancelled.",
        ]);

        return back();
    }
}
