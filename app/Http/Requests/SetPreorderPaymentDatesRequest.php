<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * The payment dates of an item's preorders (website and phone): the first
 * day buyers can pay, and the close date, the last day to pay and to
 * preorder. The rest is checked by PaymentDates.
 */
class SetPreorderPaymentDatesRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'preorder_pay_from' => ['required', 'date_format:Y-m-d'],
            'preorders_close_on' => ['required', 'date_format:Y-m-d'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'preorder_pay_from.required' => 'Choose the first day buyers can pay.',
            'preorder_pay_from.date_format' => 'Choose a valid start date.',
            'preorders_close_on.required' => 'Choose the last day to pay.',
            'preorders_close_on.date_format' => 'Choose a valid close date.',
        ];
    }
}
