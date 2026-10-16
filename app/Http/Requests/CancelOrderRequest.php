<?php

namespace App\Http\Requests;

use App\Enums\CancelReason;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * The Specialist cancels an order not picked up yet, picking why from a
 * list like in online shops (website and phone app). The student sees the
 * reason. Other asks the Specialist to write why.
 */
class CancelOrderRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'reason' => ['required', Rule::in(array_map(fn (CancelReason $reason): string => $reason->value, CancelReason::forStaff()))],
            'note' => [Rule::requiredIf($this->input('reason') === CancelReason::Other->value), 'nullable', 'string', 'min:5', 'max:200'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'reason.required' => 'Please select a reason for cancelling. The student will see it.',
            'reason.in' => 'Please select one of the reasons shown.',
            'note.required' => 'Please describe the reason for cancelling. The student will see it.',
            'note.min' => 'Please write at least 5 characters.',
            'note.max' => 'The reason may not be longer than 200 characters.',
        ];
    }

    /** The reason as the order keeps it and the student reads it. */
    public function reasonText(): string
    {
        return CancelReason::from((string) $this->input('reason'))->describe($this->input('note'));
    }
}
