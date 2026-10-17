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
     * A very long number (e.g. 2321312312313) still counts as a number, so the
     * student is told how many are left instead of "Enter a whole number".
     */
    protected function prepareForValidation(): void
    {
        $quantity = $this->input('quantity');

        if (is_string($quantity) && preg_match('/^\d{10,}$/', $quantity) === 1) {
            $this->merge(['quantity' => '999999999']);
        }
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            // The most allowed (stock, and at most Cart::maxQuantity()) is checked by the cart, with how many are left.
            'quantity' => ['required', 'integer', 'min:1'],
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
            'quantity.min' => 'The quantity must be at least 1. To take the item out, remove it.',
        ];
    }
}
