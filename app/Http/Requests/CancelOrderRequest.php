<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * The Specialist cancels an order not picked up yet, with the reason the
 * student will see (website and phone app).
 */
class CancelOrderRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            // A real reason (as on V1), like Close order (short).
            'reason' => ['required', 'string', 'min:5', 'max:200'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'reason.required' => 'Write why the order is cancelled. The student will see it.',
            'reason.min' => 'Write a little more about why the order is cancelled. The student will see it.',
            'reason.max' => 'Keep the reason to 200 characters or less.',
        ];
    }
}
