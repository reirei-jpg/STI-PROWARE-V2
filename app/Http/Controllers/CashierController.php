<?php

namespace App\Http\Controllers;

use App\Actions\Orders\MarkOrderPaid;
use App\Models\Order;
use App\Models\PreorderSlip;
use App\Services\Preorders\PreorderPayment;
use App\Services\Shop\CashierDesk;
use Closure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The cashier's Payments page (panel revision, 20 Nov 2026): scan or type
 * a buyer's issuance slip or preorder slip, collect the amount shown, and
 * Mark as paid. The Specialist then releases the items. The phone app has
 * the same (Api\V1\CashierController).
 */
class CashierController extends Controller
{
    public function index(Request $request): Response
    {
        $code = trim((string) ($request->validate(
            ['code' => ['nullable', 'string', 'max:120']],
            ['code.max' => 'The slip number is too long. Check the number or scan the QR code again.'],
        )['code'] ?? ''));

        return Inertia::render('cashier/index', [
            'code' => $code,
            'result' => $code === '' ? null : CashierDesk::lookup($code),
            'paidToday' => CashierDesk::paidToday($request->user()),
        ]);
    }

    public function payOrder(Request $request, Order $order, MarkOrderPaid $markPaid): RedirectResponse
    {
        return $this->respond(fn (): string => $markPaid->handle($order, $request->user()));
    }

    public function payPreorderSlip(Request $request, PreorderSlip $preorderSlip): RedirectResponse
    {
        return $this->respond(fn (): string => PreorderPayment::markPaid($preorderSlip, $request->user()));
    }

    /**
     * What happened, or why it was refused, as a toast.
     *
     * @param  Closure(): string  $step
     */
    private function respond(Closure $step): RedirectResponse
    {
        try {
            Inertia::flash('toast', ['type' => 'success', 'message' => $step()]);
        } catch (ValidationException $refused) {
            Inertia::flash('toast', ['type' => 'error', 'message' => $refused->validator->errors()->first()]);
        }

        return back();
    }
}
