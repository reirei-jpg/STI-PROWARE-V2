<?php

namespace App\Http\Requests;

use App\Models\Product;
use App\Services\Dashboard\TopBuyers;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Telling the top buyers about a product from the dashboard's Top buyers
 * card (website and phone): which product, how many of the top buyers, and
 * an optional short note.
 */
class AnnounceProductRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'product_id' => ['required', 'integer', Rule::exists('products', 'id')],
            'top' => ['required', 'integer', Rule::in(TopBuyers::SIZES)],
            'note' => ['nullable', 'string', 'max:'.TopBuyers::NOTE_MAX],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'product_id.required' => 'Choose the product to announce.',
            'product_id.integer' => 'Choose one of the products in stock.',
            'product_id.exists' => 'Choose one of the products in stock.',
            'top.required' => 'Choose how many of the top buyers to tell.',
            'top.integer' => 'Choose the top 10, 20 or 50 buyers.',
            'top.in' => 'Choose the top 10, 20 or 50 buyers.',
            'note.max' => 'The note can be at most '.TopBuyers::NOTE_MAX.' characters.',
        ];
    }

    public function product(): Product
    {
        return Product::query()->findOrFail($this->integer('product_id'));
    }
}
