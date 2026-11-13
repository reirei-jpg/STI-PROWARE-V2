<?php

namespace App\Http\Controllers;

use App\Http\Requests\AnnounceProductRequest;
use App\Services\Dashboard\TopBuyers;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;

/**
 * Tell the top buyers about a product in stock, from the dashboard's Top
 * buyers card. Shared with the phone (TopBuyers).
 */
class ProductAnnouncementController extends Controller
{
    public function store(AnnounceProductRequest $request): RedirectResponse
    {
        $message = TopBuyers::announce($request->product(), $request->integer('top'), $request->input('note'), $request->user());

        Inertia::flash('toast', ['type' => 'success', 'message' => $message]);

        return back();
    }
}
