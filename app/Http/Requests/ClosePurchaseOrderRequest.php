<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Closing an order that will never be fully delivered. A reason is required
 * so the School Admin and later readers know why.
 */
class ClosePurchaseOrderRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'reason' => ['required', 'string', 'min:5', 'max:500'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'reason.required' => 'Write why this order is being closed.',
            'reason.min' => 'Write a little more about why this order is being closed.',
            'reason.max' => 'Keep the reason to 500 characters or less.',
        ];
    }
}
