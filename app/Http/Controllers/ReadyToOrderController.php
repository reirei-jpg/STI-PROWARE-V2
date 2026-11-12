<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Services\Dashboard\StockCards;
use Closure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

/**
 * The Specialist's choice on the dashboard's Ready to order card, for a
 * Coming Soon item whose preorders reached the Maintenance number: Create
 * PO (its preorders close and it moves to To order) or Leave it (it comes
 * back once more are preordered). Shared with the phone (StockCards).
 */
class ReadyToOrderController extends Controller
{
    public function order(Product $product): RedirectResponse
    {
        return $this->respond(fn (): string => StockCards::closeToOrder($product));
    }

    public function leave(Product $product): RedirectResponse
    {
        return $this->respond(fn (): string => StockCards::leave($product));
    }

    /**
     * @param  Closure(): string  $step
     */
    private function respond(Closure $step): RedirectResponse
    {
        try {
            Inertia::flash('toast', ['type' => 'success', 'message' => $step()]);
        } catch (ValidationException $refused) {
            Inertia::flash('toast', ['type' => 'error', 'message' => $refused->validator->errors()->first('product')]);
        }

        return back();
    }
}
