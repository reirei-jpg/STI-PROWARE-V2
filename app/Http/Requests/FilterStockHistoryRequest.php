<?php

namespace App\Http\Requests;

use App\Models\Product;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * The variant filter on a product's Stock History, read from the page
 * address.
 */
class FilterStockHistoryRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $product = $this->route('product');

        return [
            'variant' => [
                'nullable',
                'integer',
                Rule::exists('product_variants', 'id')->where('product_id', $product instanceof Product ? $product->id : 0),
            ],
        ];
    }

    public function variantId(): ?int
    {
        return $this->filled('variant') ? $this->integer('variant') : null;
    }
}
