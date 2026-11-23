<?php

namespace App\Http\Requests;

use App\Models\Payment;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * The cashier undoes a payment recorded by mistake (website and phone app):
 * the reason is required, so the buyer, the Specialist and the record say
 * why. The routes allow only the cashier.
 */
class UndoPaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'reason' => ['required', 'string', 'min:5', 'max:200'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'reason.required' => 'Enter the reason for undoing the payment.',
            'reason.min' => 'The reason must be at least 5 characters.',
            'reason.max' => 'The reason may not be longer than 200 characters.',
        ];
    }

    /** The reason as a sentence, as the record and the notices keep it. */
    public function reasonText(): string
    {
        return Payment::sentence((string) $this->input('reason'));
    }
}
