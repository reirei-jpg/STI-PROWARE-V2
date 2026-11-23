<?php

namespace App\Http\Controllers;

use App\Actions\Orders\MarkOrderPaid;
use App\Actions\Orders\UndoOrderPayment;
use App\Actions\Preorders\UndoPreorderPayment;
use App\Http\Requests\RecordPaymentRequest;
use App\Http\Requests\UndoPaymentRequest;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PreorderSlip;
use App\Services\Preorders\PreorderPayment;
use App\Services\Shop\CashierDesk;
use App\Services\Shop\CashierRecords;
use Closure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The cashier's work (panel revision, 20 Nov 2026): the Dashboard on
 * opening the account; Record Payment, where a buyer's issuance slip or
 * preorder slip is scanned or its number typed, the amount due is
 * collected by cash or GCash, and a Payment Receipt is issued; the receipt
 * itself (view and print); and undoing a payment recorded by mistake. The
 * Specialist then releases the items. The phone app has the same
 * (Api\V1\CashierController).
 */
class CashierController extends Controller
{
    /**
     * What the cashier sees on opening the account.
     */
    public function index(): Response
    {
        return Inertia::render('cashier/dashboard', CashierRecords::dashboard());
    }

    /**
     * Record Payment: the slip scanned or typed, what to collect, and Mark as Paid.
     */
    public function record(Request $request): Response
    {
        $code = trim((string) ($request->validate(
            ['code' => ['nullable', 'string', 'max:120']],
            ['code.max' => 'The slip number is too long. Check the number or scan the QR code again.'],
        )['code'] ?? ''));

        return Inertia::render('cashier/record', [
            'code' => $code,
            'result' => $code === '' ? null : CashierDesk::lookup($code),
            'paidToday' => CashierDesk::paidToday(),
        ]);
    }

    public function payOrder(RecordPaymentRequest $request, Order $order, MarkOrderPaid $markPaid): RedirectResponse
    {
        return $this->paid(function () use ($request, $order, $markPaid): array {
            $message = $markPaid->handle($order, $request->user(), $request->tender());

            return [$message, $markPaid->payment];
        });
    }

    public function payPreorderSlip(RecordPaymentRequest $request, PreorderSlip $preorderSlip): RedirectResponse
    {
        return $this->paid(function () use ($request, $preorderSlip): array {
            $payment = PreorderPayment::markPaid($preorderSlip, $request->user(), $request->tender());

            return [PreorderPayment::paidMessage($preorderSlip), $payment];
        });
    }

    /**
     * A Payment Receipt on screen (the cashier, or the School Admin read-only).
     */
    public function receipt(Request $request, Payment $payment): Response
    {
        return Inertia::render('cashier/receipt', [
            'receipt' => CashierRecords::receipt($payment),
            'canPrint' => $request->user()->isCashier(),
        ]);
    }

    /**
     * The receipt alone on the page, for paper. Every print after the first is marked REPRINT.
     */
    public function printReceipt(Payment $payment): Response
    {
        $payment->increment('prints');

        return Inertia::render('print/payment-receipt', ['receipt' => CashierRecords::receipt($payment->refresh())]);
    }

    /**
     * Undo an order's payment recorded by mistake (the same day, before release).
     */
    public function undoOrderPayment(UndoPaymentRequest $request, Order $order, UndoOrderPayment $undo): RedirectResponse
    {
        return $this->respond(fn (): string => $undo->handle($order, $request->user(), $request->reasonText()));
    }

    /**
     * Undo a preorder slip's payment recorded by mistake (the same day, before its items arrive).
     */
    public function undoPreorderPayment(UndoPaymentRequest $request, PreorderSlip $preorderSlip, UndoPreorderPayment $undo): RedirectResponse
    {
        return $this->respond(fn (): string => $undo->handle($preorderSlip, $request->user(), $request->reasonText()));
    }

    /**
     * Recorded: the receipt opens, ready to print. A short amount or a used
     * GCash reference goes back to the form under its field; any other
     * refusal is a toast.
     *
     * @param  Closure(): array{0: string, 1: Payment|null}  $step
     */
    private function paid(Closure $step): RedirectResponse
    {
        try {
            [$message, $payment] = $step();
        } catch (ValidationException $refused) {
            if (array_intersect(array_keys($refused->errors()), ['amount_received', 'gcash_reference']) !== []) {
                throw $refused;
            }

            Inertia::flash('toast', ['type' => 'error', 'message' => $refused->validator->errors()->first()]);

            return back();
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => $message]);

        return $payment === null ? back() : to_route('cashier.receipts.show', $payment);
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
