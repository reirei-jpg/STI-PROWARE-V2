<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * The expected delivery date the Specialist enters after Head Office calls.
 * An empty date clears it.
 */
class SetExpectedDeliveryRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'expected_delivery_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:today'],
            'expected_delivery_note' => ['nullable', 'string', 'max:200'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'expected_delivery_date.date_format' => 'Choose a valid date.',
            'expected_delivery_date.after_or_equal' => 'The expected delivery date cannot be in the past.',
            'expected_delivery_note.max' => 'Keep the note to 200 characters or less.',
        ];
    }
}
