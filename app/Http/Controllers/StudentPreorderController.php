<?php

namespace App\Http\Controllers;

use App\Actions\Preorders\CancelPreorderByStudent;
use App\Actions\Preorders\EditPreorderByStudent;
use App\Actions\Preorders\PlacePreorder;
use App\Http\Requests\EditPreorderRequest;
use App\Http\Requests\PlacePreorderRequest;
use App\Models\Preorder;
use App\Models\PreorderSlip;
use App\Models\Product;
use App\Services\Preorders\PreorderPayment;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * A buyer's preorders: reservations of Coming Soon products or sold-out
 * sizes, each batch paid at the cashier with its preorder slip.
 */
class StudentPreorderController extends Controller
{
    /**
     * My Preorders: the student's preorders, active ones first, newest first.
     */
    public function index(Request $request): Response
    {
        return Inertia::render('storefront/my-preorders', [
            'preorders' => CancelPreorderByStudent::studentPage($request->user()),
        ]);
    }

    /**
     * The preorder slip: what to pay at the cashier, or PAID as the buyer's
     * proof of payment.
     */
    public function slip(Request $request, PreorderSlip $preorderSlip): Response
    {
        abort_unless($preorderSlip->user_id === $request->user()->id, 404);

        return Inertia::render('storefront/preorder-slip', [
            'slip' => PreorderPayment::view($preorderSlip),
        ]);
    }

    /**
     * Preorder sizes or colors. Preordering the same one again changes how
     * many, so a student has one preorder per size or color.
     */
    public function store(PlacePreorderRequest $request, Product $product, PlacePreorder $placePreorder): RedirectResponse
    {
        $preorders = $placePreorder->handleMany($request->user(), $product, $request->items());

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => PlacePreorder::messageForMany($preorders, $product),
        ]);

        return back();
    }

    /**
     * Change the size, color or quantity of a waiting preorder. Lowering the
     * quantity keeps its place in line; anything else moves it to the end.
     */
    public function update(EditPreorderRequest $request, Preorder $preorder, EditPreorderByStudent $editPreorder): RedirectResponse
    {
        $moved = $editPreorder->handle($preorder, $request->variant(), $request->integer('quantity'));

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => EditPreorderByStudent::message($preorder, $moved),
        ]);

        return back();
    }

    /**
     * Cancel a preorder, while preorders for the product are still open.
     */
    public function destroy(Request $request, Preorder $preorder, CancelPreorderByStudent $cancelPreorder): RedirectResponse
    {
        abort_unless($preorder->user_id === $request->user()->id, 404);

        $refusal = CancelPreorderByStudent::refusal($preorder);

        if ($refusal !== null) {
            Inertia::flash('toast', ['type' => 'error', 'message' => $refusal]);

            return back();
        }

        $cancelPreorder->handle($preorder);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => CancelPreorderByStudent::message($preorder),
        ]);

        return back();
    }
}
