<?php

namespace App\Http\Controllers;

use App\Actions\Preorders\MarkNotRestocked;
use App\Http\Requests\MarkNotRestockedRequest;
use App\Models\ProductVariant;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;

/**
 * On the Preorders page, the Specialist says a sold-out size will not be
 * restocked (closing every preorder waiting for it), or allows students to
 * preorder it again.
 */
class PreorderRestockController extends Controller
{
    public function store(MarkNotRestockedRequest $request, ProductVariant $variant, MarkNotRestocked $markNotRestocked): RedirectResponse
    {
        $students = $markNotRestocked->handle($variant, $request->reason());

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => MarkNotRestocked::message($variant->load('product'), $students),
        ]);

        return back();
    }

    public function destroy(ProductVariant $variant, MarkNotRestocked $markNotRestocked): RedirectResponse
    {
        $markNotRestocked->undo($variant);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => "Students can preorder {$variant->load('product')->displayName()} again while it is out of stock.",
        ]);

        return back();
    }
}
