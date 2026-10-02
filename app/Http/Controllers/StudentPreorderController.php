<?php

namespace App\Http\Controllers;

use App\Enums\PreorderStatus;
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
            ->through(fn (Preorder $preorder): array => [
                'id' => $preorder->id,
                'product_name' => $preorder->product->name,
                'photo_url' => $preorder->product->mainPhoto?->url(),
                'variant_label' => $preorder->variant->choices === [] ? null : $preorder->variant->label(),
                'quantity' => $preorder->quantity,
                'status' => $preorder->status->value,
                'status_label' => $preorder->status->label(),
                'preorders_close_on' => $preorder->product->preorders_close_on?->toDateString(),
                'can_cancel' => $preorder->status === PreorderStatus::Active && $preorder->product->acceptsPreorders(),
                'created_at' => $preorder->created_at?->toIso8601String(),
            ]);

        return Inertia::render('storefront/my-preorders', [
            'preorders' => $preorders,
        ]);
    }

    /**
     * Preorder a size or color. Preordering the same one again changes how
     * many, so a student has one preorder per size or color.
     */
    public function store(PlacePreorderRequest $request, Product $product): RedirectResponse
    {
        $preorder = $request->user()->preorders()->updateOrCreate(
            [
                'product_variant_id' => $request->integer('product_variant_id'),
                'status' => PreorderStatus::Active,
            ],
            [
                'product_id' => $product->id,
                'quantity' => $request->integer('quantity'),
            ],
        );

        $variant = $preorder->variant;

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => "Preordered {$preorder->quantity} × {$product->name}".($variant->choices === [] ? '' : " ({$variant->label()})").'. You can see it in My Preorders.',
        ]);

        return back();
    }

    /**
     * Cancel a preorder, while preorders for the product are still open.
     */
    public function destroy(Request $request, Preorder $preorder): RedirectResponse
    {
        abort_unless($preorder->user_id === $request->user()->id, 404);

        $product = $preorder->product;

        if ($preorder->status !== PreorderStatus::Active || ! $product->acceptsPreorders()) {
            Inertia::flash('toast', [
                'type' => 'error',
                'message' => "Preorders for {$product->name} are closed, so this preorder can no longer be cancelled here. Please ask the PROWARE office.",
            ]);

            return back();
        }

        $preorder->update(['status' => PreorderStatus::Cancelled, 'cancelled_at' => now()]);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => "Your preorder for {$product->name} was cancelled.",
        ]);

        return back();
    }
}
