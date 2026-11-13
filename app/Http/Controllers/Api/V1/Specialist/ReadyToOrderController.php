<?php

namespace App\Http\Controllers\Api\V1\Specialist;

use App\Http\Controllers\Controller;
use App\Http\Requests\SetPreorderPaymentDatesRequest;
use App\Models\Product;
use App\Services\Dashboard\StockCards;
use App\Services\Preorders\PaymentDates;
use Illuminate\Http\JsonResponse;

/**
 * Create PO or Leave it on the phone's Ready to order card, as on the
 * website (StockCards).
 */
class ReadyToOrderController extends Controller
{
    public function order(Product $product): JsonResponse
    {
        return response()->json(['message' => StockCards::closeToOrder($product)]);
    }

    /**
     * Set the payment dates of the item's preorders, as on the website.
     */
    public function paymentDates(SetPreorderPaymentDatesRequest $request, Product $product): JsonResponse
    {
        return response()->json(['message' => PaymentDates::set($product, (string) $request->input('preorder_pay_from'), (string) $request->input('preorders_close_on'))]);
    }

    public function leave(Product $product): JsonResponse
    {
        return response()->json(['message' => StockCards::leave($product)]);
    }
}
