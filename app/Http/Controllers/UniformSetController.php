<?php

namespace App\Http\Controllers;

use App\Http\Requests\SaveUniformSetRequest;
use App\Models\UniformSet;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;

/**
 * The uniform sets of the Free Uniforms page, one per course: what its
 * free set is made of (the blouse and / or polo, and the pants). Students
 * already given a set keep the pieces they got when a set is changed.
 */
class UniformSetController extends Controller
{
    public function store(SaveUniformSetRequest $request): RedirectResponse
    {
        $set = UniformSet::query()->create($request->values());

        Inertia::flash('toast', ['type' => 'success', 'message' => "The {$set->name} set was added."]);

        return back();
    }

    public function update(SaveUniformSetRequest $request, UniformSet $uniformSet): RedirectResponse
    {
        $uniformSet->update($request->values());

        Inertia::flash('toast', ['type' => 'success', 'message' => "The {$uniformSet->name} set was saved."]);

        return back();
    }
}
