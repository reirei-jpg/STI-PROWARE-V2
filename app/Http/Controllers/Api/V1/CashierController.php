<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Orders\MarkOrderPaid;
use App\Actions\Orders\UndoOrderPayment;
use App\Actions\Preorders\UndoPreorderPayment;
use App\Http\Controllers\Controller;
use App\Http\Requests\UndoPaymentRequest;
use App\Models\Order;
use App\Models\PreorderSlip;
use App\Services\Preorders\PreorderPayment;
use App\Services\Shop\CashierDesk;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The cashier on the phone app, with the website's rules (CashierDesk,
 * MarkOrderPaid, PreorderPayment). A refusal answers 422 with its reason.
 */
class CashierController extends Controller
{
    /**
     * A scanned or typed slip (404 when it is not a PROWARE slip), and what
     * this cashier collected today.
     */
    public function lookup(Request $request): JsonResponse
    {
        $code = trim((string) ($request->validate(['code' => ['required', 'string', 'max:120']], ['code.required' => 'Scan the slip or enter its number.', 'code.max' => 'The slip number is too long. Check the number or scan the QR code again.'])['code']));
        $result = CashierDesk::lookup($code);

        abort_if($result === null, 404, 'No PROWARE slip matches this code. Check the number or scan the QR code again.');

        return response()->json($result);
    }

    public function paidToday(Request $request): JsonResponse
    {
        return response()->json(CashierDesk::paidToday($request->user()));
    }

    public function payOrder(Request $request, Order $order, MarkOrderPaid $markPaid): JsonResponse
    {
        return response()->json([
            'message' => $markPaid->handle($order, $request->user()),
            'result' => CashierDesk::lookup((string) $order->number),
        ]);
    }

    public function payPreorderSlip(Request $request, PreorderSlip $preorderSlip): JsonResponse
    {
        return response()->json([
            'message' => PreorderPayment::markPaid($preorderSlip, $request->user()),
            'result' => CashierDesk::lookup((string) $preorderSlip->number),
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
}
