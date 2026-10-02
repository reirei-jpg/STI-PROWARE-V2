<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * The search and the All / In stock / Sold out choice on the storefront's
 * All Merchandise feed, read from the page address.
 */
class FilterStorefrontRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'search' => ['nullable', 'string', 'max:120'],
            'show' => ['nullable', 'in:in_stock,sold_out'],
        ];
    }

    public function search(): ?string
    {
        $search = trim((string) $this->input('search', ''));

        return $search === '' ? null : $search;
    }

    /**
     * @return 'in_stock'|'sold_out'|null
     */
    public function show(): ?string
    {
        return match ($this->input('show')) {
            'in_stock' => 'in_stock',
            'sold_out' => 'sold_out',
            default => null,
        };
    }
}
