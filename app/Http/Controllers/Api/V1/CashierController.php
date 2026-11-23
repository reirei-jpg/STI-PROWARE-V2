<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Orders\MarkOrderPaid;
use App\Actions\Orders\UndoOrderPayment;
use App\Actions\Preorders\UndoPreorderPayment;
use App\Http\Controllers\Controller;
use App\Http\Requests\FilterPaymentsRequest;
use App\Http\Requests\RecordPaymentRequest;
use App\Http\Requests\UndoPaymentRequest;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PreorderSlip;
use App\Services\Preorders\PreorderPayment;
use App\Services\Shop\CashierDesk;
use App\Services\Shop\CashierRecords;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The cashier on the phone app, with the website's rules (CashierDesk,
 * CashierRecords, MarkOrderPaid, PreorderPayment): the dashboard, a slip
 * scanned or typed, Mark as Paid by cash or GCash with its Payment Receipt,
 * undoing a payment recorded by mistake, Awaiting Payment, Payment History
 * and Collections. A refusal answers 422 with its reason.
 */
class CashierController extends Controller
{
    public function dashboard(): JsonResponse
    {
        return response()->json(CashierRecords::dashboard());
    }

    /**
     * A scanned or typed slip (404 when it is not a PROWARE slip).
     */
    public function lookup(Request $request): JsonResponse
    {
        $code = trim((string) ($request->validate(['code' => ['required', 'string', 'max:120']], ['code.required' => 'Scan the slip or enter its number.', 'code.max' => 'The slip number is too long. Check the number or scan the QR code again.'])['code']));
        $result = CashierDesk::lookup($code);

        abort_if($result === null, 404, 'No PROWARE slip matches this code. Check the number or scan the QR code again.');

        return response()->json($result);
    }

    public function paidToday(): JsonResponse
    {
        return response()->json(CashierDesk::paidToday());
    }

    public function payOrder(RecordPaymentRequest $request, Order $order, MarkOrderPaid $markPaid): JsonResponse
    {
        $message = $markPaid->handle($order, $request->user(), $request->tender());

        return response()->json([
            'message' => $message,
            'result' => CashierDesk::lookup((string) $order->number),
            'receipt' => $markPaid->payment === null ? null : CashierRecords::receipt($markPaid->payment),
        ]);
    }

    public function payPreorderSlip(RecordPaymentRequest $request, PreorderSlip $preorderSlip): JsonResponse
    {
        $payment = PreorderPayment::markPaid($preorderSlip, $request->user(), $request->tender());

        return response()->json([
            'message' => PreorderPayment::paidMessage($preorderSlip),
            'result' => CashierDesk::lookup((string) $preorderSlip->number),
            'receipt' => CashierRecords::receipt($payment),
        ]);
    }

    public function undoOrderPayment(UndoPaymentRequest $request, Order $order, UndoOrderPayment $undo): JsonResponse
    {
        return response()->json([
            'message' => $undo->handle($order, $request->user(), $request->reasonText()),
            'result' => CashierDesk::lookup((string) $order->number),
        ]);
    }

    public function undoPreorderPayment(UndoPaymentRequest $request, PreorderSlip $preorderSlip, UndoPreorderPayment $undo): JsonResponse
    {
        return response()->json([
            'message' => $undo->handle($preorderSlip, $request->user(), $request->reasonText()),
            'result' => CashierDesk::lookup((string) $preorderSlip->number),
        ]);
    }

    public function receipt(Payment $payment): JsonResponse
    {
        return response()->json(CashierRecords::receipt($payment));
    }

    public function awaiting(Request $request): JsonResponse
    {
        $search = trim((string) ($request->validate(
            ['search' => ['nullable', 'string', 'max:100']],
            ['search.max' => 'The search may not be longer than 100 characters.'],
        )['search'] ?? ''));

        return response()->json([
            'orders' => CashierRecords::awaitingOrders($search),
            'slips' => CashierRecords::awaitingSlips($search),
        ]);
    }

    public function history(FilterPaymentsRequest $request): JsonResponse
    {
        $filters = $request->filters();

        return response()->json([...CashierRecords::history($filters), 'filters' => $filters]);
    }

    public function collections(FilterPaymentsRequest $request): JsonResponse
    {
        $filters = $request->filters('month');

        return response()->json([...CashierRecords::collections($filters), 'filters' => $filters]);
    }
}
