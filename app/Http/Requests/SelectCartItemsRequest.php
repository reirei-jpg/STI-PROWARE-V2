<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Tick or untick cart lines for the next Place Order: one line, or all of
 * them ("Select all"). Only the student's own lines are changed.
 */
class SelectCartItemsRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'cart_item_ids' => ['required', 'array', 'min:1'],
            'cart_item_ids.*' => ['integer'],
            'selected' => ['required', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'cart_item_ids.required' => 'Choose at least one item.',
            'cart_item_ids.min' => 'Choose at least one item.',
        ];
    }

    /**
     * @return list<int>
     */
    public function cartItemIds(): array
    {
        return array_values(array_map(intval(...), (array) $this->input('cart_item_ids')));
    }
}
