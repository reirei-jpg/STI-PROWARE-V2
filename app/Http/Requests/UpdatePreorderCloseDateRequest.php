<?php

namespace App\Http\Requests;

use App\Enums\ProductStatus;
use App\Models\Product;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * The Specialist moves the last day students can preorder a product, e.g.
 * to collect more preorders before ordering in the eStore.
 */
class UpdatePreorderCloseDateRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'preorders_close_on' => ['required', 'date_format:Y-m-d', 'after_or_equal:today'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'preorders_close_on.required' => 'Choose the last day students can preorder.',
            'preorders_close_on.date_format' => 'Choose a valid date.',
            'preorders_close_on.after_or_equal' => 'The close date cannot be in the past.',
        ];
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $product = $this->route('product');

                if ($product instanceof Product && $product->status !== ProductStatus::Preorder) {
                    $validator->errors()->add('preorders_close_on', "{$product->name} is no longer a Preorder product.");

                    return;
                }

                // Preorders close before it is expected to arrive.
                $date = $this->input('preorders_close_on');

                if ($product instanceof Product && is_string($date) && $product->expected_arrival_from !== null && $date >= $product->expected_arrival_from->toDateString()) {
                    $validator->errors()->add('preorders_close_on', "The close date must be before the expected arrival ({$product->expectedArrivalText()}). Change the expected arrival in Edit Product first.");
                }
            },
        ];
    }
}
