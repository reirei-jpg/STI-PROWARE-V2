<?php

namespace App\Http\Requests;

use App\Services\Shop\Cart;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * A new quantity for a line in the student's cart. Whether there is enough
 * stock is checked by the cart.
 */
class ChangeCartQuantityRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'quantity' => ['required', 'integer', 'min:1', 'max:'.Cart::MAX_QUANTITY],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'quantity.required' => 'Enter how many you want.',
            'quantity.integer' => 'Enter a whole number.',
            'quantity.min' => 'Keep at least 1, or remove the item.',
            'quantity.max' => 'For more than '.number_format(Cart::MAX_QUANTITY).', please talk to the PROWARE office.',
        ];
    }
}
