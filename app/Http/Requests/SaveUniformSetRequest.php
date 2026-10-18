<?php

namespace App\Http\Requests;

use App\Models\UniformSet;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Add or change a course's uniform set: its name (e.g. BSIT), the blouse
 * and / or the polo, and the pants, each a product. To sell it whole to
 * students: the girls' ladies' pants and / or skirt, and the set price
 * (empty: not sold as a set).
 */
class SaveUniformSetRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('name'))) {
            $this->merge(['name' => preg_replace('/\s+/', ' ', trim($this->input('name')))]);
        }
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $set = $this->route('uniformSet');

        return [
            'name' => ['required', 'string', 'max:60', Rule::unique('uniform_sets', 'name')->ignore($set instanceof UniformSet ? $set->id : null)],
            'blouse_product_id' => ['nullable', 'integer', Rule::exists('products', 'id')],
            'polo_product_id' => ['nullable', 'integer', Rule::exists('products', 'id')],
            'pants_product_id' => ['required', 'integer', Rule::exists('products', 'id')],
            'ladies_pants_product_id' => ['nullable', 'integer', Rule::exists('products', 'id')],
            'skirt_product_id' => ['nullable', 'integer', Rule::exists('products', 'id')],
            'set_price' => ['nullable', 'decimal:0,2', 'gt:0', 'max:'.SaveProductRequest::MAX_PRICE_PESOS],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Enter the course, e.g. BSIT.',
            'name.max' => 'The name may not be longer than 60 characters.',
            'name.unique' => 'There is already a :input set.',
            'blouse_product_id.exists' => 'Choose one of the products.',
            'polo_product_id.exists' => 'Choose one of the products.',
            'pants_product_id.required' => 'Choose the pants product.',
            'pants_product_id.exists' => 'Choose one of the products.',
            'ladies_pants_product_id.exists' => 'Choose one of the products.',
            'skirt_product_id.exists' => 'Choose one of the products.',
            'set_price.decimal' => 'Enter the set price in pesos, e.g. 1100.',
            'set_price.gt' => 'The set price must be more than ₱0.',
            'set_price.max' => 'The set price cannot be more than ₱'.number_format(SaveProductRequest::MAX_PRICE_PESOS, 2).'.',
        ];
    }

    /**
     * A set needs at least one top: the blouse, the polo, or both. A set
     * price needs something to sell: the polo (with the pants), or the
     * blouse with the ladies' pants or the skirt.
     *
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if (! $this->filled('blouse_product_id') && ! $this->filled('polo_product_id')) {
                    $validator->errors()->add('blouse_product_id', 'Choose the blouse, the polo, or both.');
                }

                if ($this->filled('set_price') && ! $this->filled('polo_product_id')
                    && ! ($this->filled('blouse_product_id') && ($this->filled('ladies_pants_product_id') || $this->filled('skirt_product_id')))) {
                    $validator->errors()->add('set_price', "To sell the set, choose the polo (for boys), or the blouse with the ladies' pants or the skirt (for girls).");
                }
            },
        ];
    }

    /**
     * @return array{name: string, blouse_product_id: int|null, polo_product_id: int|null, pants_product_id: int, ladies_pants_product_id: int|null, skirt_product_id: int|null, set_price_centavos: int|null}
     */
    public function values(): array
    {
        return [
            'name' => (string) $this->input('name'),
            'blouse_product_id' => $this->filled('blouse_product_id') ? $this->integer('blouse_product_id') : null,
            'polo_product_id' => $this->filled('polo_product_id') ? $this->integer('polo_product_id') : null,
            'pants_product_id' => $this->integer('pants_product_id'),
            'ladies_pants_product_id' => $this->filled('ladies_pants_product_id') ? $this->integer('ladies_pants_product_id') : null,
            'skirt_product_id' => $this->filled('skirt_product_id') ? $this->integer('skirt_product_id') : null,
            'set_price_centavos' => $this->filled('set_price') ? SaveProductRequest::toCentavos((string) $this->input('set_price')) : null,
        ];
    }
}
