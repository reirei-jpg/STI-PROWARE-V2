<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Releasing an order (website and phone app): the Specialist must confirm
 * the student has paid before the items leave the shelf.
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
            'paid.accepted' => 'Confirm that the student has paid before releasing the items.',
        ];
    }
}
