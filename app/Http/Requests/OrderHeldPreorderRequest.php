<?php

namespace App\Http\Requests;

use App\Models\Preorder;
use App\Services\Stock\Units;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Order Now on a held preorder: how many of the held pieces (all or
 * fewer), and the course/section for the issuance slip if given.
 */
class OrderHeldPreorderRequest extends FormRequest
{
    /**
     * Only the student whose preorder it is.
     */
    public function authorize(): bool
    {
        return $this->preorder()->user_id === $this->user()?->id;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'quantity' => ['required', 'integer', 'min:1', 'max:'.$this->preorder()->quantity],
            'section' => ['nullable', 'string', 'max:40'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'quantity.required' => 'Enter how many you want to order.',
            'quantity.integer' => 'Enter a whole number.',
            'quantity.min' => 'The quantity must be at least 1.',
            'quantity.max' => 'Only '.Units::count($this->preorder()->quantity, 'Piece').' are held for you.',
            'section.max' => 'The course/section may not be longer than 40 characters, e.g. BSIT 1-A.',
        ];
    }

    public function preorder(): Preorder
    {
        $preorder = $this->route('preorder');

        return $preorder instanceof Preorder ? $preorder : abort(404);
    }

    public function section(): ?string
    {
        $section = $this->input('section');

        return is_string($section) ? $section : null;
    }
}
