<?php

namespace App\Http\Requests;

use App\Models\UniformSet;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Add or change a course's uniform set: its name (e.g. BSIT), the blouse
 * and / or the polo, and the pants, each a product.
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
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Enter the course, e.g. BSIT.',
            'name.max' => 'Keep the name to 60 characters or less.',
            'name.unique' => 'There is already a :input set.',
            'blouse_product_id.exists' => 'Choose one of the products.',
            'polo_product_id.exists' => 'Choose one of the products.',
            'pants_product_id.required' => 'Choose the pants product.',
            'pants_product_id.exists' => 'Choose one of the products.',
        ];
    }

    /**
     * A set needs at least one top: the blouse, the polo, or both.
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
            },
        ];
    }

    /**
     * @return array{name: string, blouse_product_id: int|null, polo_product_id: int|null, pants_product_id: int}
     */
    public function values(): array
    {
        return [
            'name' => (string) $this->input('name'),
            'blouse_product_id' => $this->filled('blouse_product_id') ? $this->integer('blouse_product_id') : null,
            'polo_product_id' => $this->filled('polo_product_id') ? $this->integer('polo_product_id') : null,
            'pants_product_id' => $this->integer('pants_product_id'),
        ];
    }
}
