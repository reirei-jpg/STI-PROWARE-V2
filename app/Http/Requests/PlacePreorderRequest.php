<?php

namespace App\Http\Requests;

use App\Enums\ProductStatus;
use App\Models\Product;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * A student's preorder: which size or color and how many. There is no limit
 * on how many, and no payment; it is a reservation. Only Preorder products
 * whose close date has not passed take preorders.
 */
class PlacePreorderRequest extends FormRequest
{
    public const MAX_QUANTITY = 1000;

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
            'quantity.min' => 'Preorder at least 1.',
            'quantity.max' => 'For more than '.number_format(self::MAX_QUANTITY).', please talk to the PROWARE office.',
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

                if ($product->acceptsPreorders()) {
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
