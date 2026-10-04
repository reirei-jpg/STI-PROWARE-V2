<?php

namespace App\Http\Controllers;

use App\Actions\Orders\HandleOrderBySpecialist;
use App\Http\Requests\CancelOrderRequest;
use App\Models\Order;
use App\Services\Shop\SpecialistOrders;
use Closure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The Specialist's Orders page: students' orders to prepare and hand over.
 * The steps (Ready for pickup, Picked up, undo, Cancel) are in
 * HandleOrderBySpecialist, shared with the phone app.
 */
class OrderController extends Controller
{
    /**
     * Orders by status (New orders by default), with a search by order
     * number or student name.
     */
    public function index(Request $request): Response
    {
        $filters = SpecialistOrders::filters($request);

        return Inertia::render('orders/index', [
            'orders' => SpecialistOrders::page($filters['show'], $filters['search']),
            'filters' => $filters,
            'counts' => SpecialistOrders::counts(),
        ]);
    }

    public function ready(Request $request, Order $order, HandleOrderBySpecialist $handle): RedirectResponse
    {
        return $this->respond(fn (): string => $handle->ready($order, $request->user()));
    }

    public function pickedUp(Request $request, Order $order, HandleOrderBySpecialist $handle): RedirectResponse
    {
        return $this->respond(fn (): string => $handle->pickedUp($order, $request->user()));
    }

    public function undoPickup(Order $order, HandleOrderBySpecialist $handle): RedirectResponse
    {
        return $this->respond(fn (): string => $handle->undoPickup($order));
    }

    public function cancel(CancelOrderRequest $request, Order $order, HandleOrderBySpecialist $handle): RedirectResponse
    {
        return $this->respond(fn (): string => $handle->cancel($order, $request->user(), $request->string('reason')->toString()));
    }

    /**
     * Show what happened, or why it was refused, as a toast.
     *
     * @param  Closure(): string  $step
     */
    private function respond(Closure $step): RedirectResponse
    {
        try {
            Inertia::flash('toast', ['type' => 'success', 'message' => $step()]);
        } catch (ValidationException $refused) {
            Inertia::flash('toast', ['type' => 'error', 'message' => $refused->validator->errors()->first('order')]);
        }

        return back();
    }
}
