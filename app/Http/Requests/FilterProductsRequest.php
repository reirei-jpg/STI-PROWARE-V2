<?php

namespace App\Http\Requests;

use App\Enums\ProductStatus;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * The search, status filter and "Low stock" filter on the Products list,
 * read from the page address.
 */
class FilterProductsRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'search' => ['nullable', 'string', 'max:120'],
            'status' => ['nullable', Rule::enum(ProductStatus::class)],
            'stock' => ['nullable', 'in:low'],
        ];
    }

    public function lowStockOnly(): bool
    {
        return $this->input('stock') === 'low';
    }

    public function search(): ?string
    {
        $search = trim((string) $this->input('search', ''));

        return $search === '' ? null : $search;
    }

    public function status(): ?ProductStatus
    {
        return $this->filled('status') ? ProductStatus::from((string) $this->input('status')) : null;
    }
}
