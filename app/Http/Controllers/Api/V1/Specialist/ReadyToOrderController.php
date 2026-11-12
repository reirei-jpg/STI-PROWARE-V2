<?php

namespace App\Http\Controllers\Api\V1\Specialist;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Services\Dashboard\StockCards;
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

    public function leave(Product $product): JsonResponse
    {
        return response()->json(['message' => StockCards::leave($product)]);
    }
}
