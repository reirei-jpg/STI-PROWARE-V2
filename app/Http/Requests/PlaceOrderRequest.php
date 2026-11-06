<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Place Order (website and phone app): the student's course/section for the
 * issuance slip, if they give it (saved for next time).
 */
class PlaceOrderRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'section' => ['nullable', 'string', 'max:40', 'regex:'.User::SECTION_PATTERN],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'section.max' => 'The course/section may not be longer than 40 characters, e.g. BSIT 1-A.',
            'section.regex' => User::SECTION_MESSAGE,
        ];
    }

    public function section(): ?string
    {
        return $this->filled('section') ? $this->string('section')->trim()->toString() : null;
    }
}
