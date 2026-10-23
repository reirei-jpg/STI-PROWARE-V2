<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Releasing an order (website and phone app): the student paid at the
 * cashier, and the Specialist must confirm she checked the cashier's
 * receipt before the items leave the shelf.
 */
class ReleaseOrderRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'paid' => ['accepted'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'paid.accepted' => "Check the student's cashier receipt and tick the box before releasing the items.",
        ];
    }
}
