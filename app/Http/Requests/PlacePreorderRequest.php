<?php

namespace App\Http\Requests;

use App\Enums\ProductStatus;
use App\Models\Product;
use App\Services\Shop\Cart;
use App\Services\Stock\LowStockAlerts;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * A student's preorder: which size or color and how many. There is no
 * payment; it is a reservation. Preorder products take preorders until
 * their close date; a product for sale takes them only for a size that is
 * sold out and not marked "will not be restocked".
 */
class PlacePreorderRequest extends FormRequest
{
    /** The most of one item a student can preorder at once (as on V1). */
    public const MAX_QUANTITY = Cart::MAX_QUANTITY;

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'product_variant_id' => [
                'required',
                'integer',
                Rule::exists('product_variants', 'id')->where('product_id', $this->product()->id),
            ],
            'quantity' => ['required', 'integer', 'min:1', 'max:'.self::MAX_QUANTITY],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'product_variant_id.required' => 'Choose the size or color you want.',
            'product_variant_id.exists' => 'Choose one of this item\'s sizes or colors.',
            'quantity.required' => 'Enter how many you want.',
            'quantity.integer' => 'Enter a whole number.',
            'quantity.min' => 'The quantity must be at least 1.',
            'quantity.max' => 'For more than '.number_format(self::MAX_QUANTITY).', contact the PROWARE office.',
        ];
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $product = $this->product();

                if ($product->acceptsPreorders() || $validator->errors()->has('product_variant_id')) {
                    return;
                }

                if (LowStockAlerts::isSold($product)) {
                    $variant = $product->variants()->findOrFail($this->integer('product_variant_id'))->setRelation('product', $product);

                    if ($variant->freeToSell() > 0) {
                        $validator->errors()->add('product_variant_id', "{$variant->displayName()} is in stock. Add it to your cart instead.");
                    } elseif ($variant->not_restocked_at !== null) {
                        $validator->errors()->add('product_variant_id', "{$variant->displayName()} will not be restocked, so it cannot be preordered.");
                    }

                    return;
                }

                $validator->errors()->add('quantity', $product->preorders_close_on !== null && $product->status === ProductStatus::Preorder
                    ? "Preorders for {$product->name} closed on {$product->preorders_close_on->format('M j, Y')}."
                    : "{$product->name} is not open for preorder.");
            },
        ];
    }

    public function product(): Product
    {
        $product = $this->route('product');

        return $product instanceof Product ? $product : abort(404);
    }
}
