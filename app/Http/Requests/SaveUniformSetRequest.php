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
 * students (at what its pieces cost): the girls' ladies' pants and / or
 * skirt, and Sell this set in the store.
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
            'sold_as_set' => ['nullable', 'boolean'],
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
            'sold_as_set.boolean' => 'Tick or untick Sell this set in the store.',
        ];
    }

    /**
     * A set needs at least one top: the blouse, the polo, or both. Selling
     * it as a set needs something to sell: the polo (with the pants), or the
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

                if ($this->boolean('sold_as_set') && ! $this->filled('polo_product_id')
                    && ! ($this->filled('blouse_product_id') && ($this->filled('ladies_pants_product_id') || $this->filled('skirt_product_id')))) {
                    $validator->errors()->add('sold_as_set', "To sell the set, choose the polo (for boys), or the blouse with the ladies' pants or the skirt (for girls).");
                }
            },
        ];
    }

    /**
     * @return array{name: string, blouse_product_id: int|null, polo_product_id: int|null, pants_product_id: int, ladies_pants_product_id: int|null, skirt_product_id: int|null, sold_as_set: bool}
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
            'sold_as_set' => $this->boolean('sold_as_set'),
        ];
    }
}
