<?php

namespace App\Http\Requests;

use App\Enums\ProductStatus;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * The search, status filter and the "Low stock" / "Slow-moving" filters on
 * the Products list, read from the page address. Slow-moving means no sales
 * for 18 days unless the Specialist chooses another number.
 */
class FilterProductsRequest extends FormRequest
{
    public const DEFAULT_SLOW_MOVING_DAYS = 18;

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'search' => ['nullable', 'string', 'max:120'],
            'status' => ['nullable', Rule::enum(ProductStatus::class)],
            'stock' => ['nullable', 'in:low,slow'],
            'slow_days' => ['nullable', 'integer', 'min:1', 'max:365'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'slow_days.integer' => 'Enter the number of days as a whole number.',
            'slow_days.min' => 'Enter at least 1 day.',
            'slow_days.max' => 'Enter at most 365 days.',
        ];
    }

    /**
     * @return 'low'|'slow'|null
     */
    public function stockFilter(): ?string
    {
        return match ($this->input('stock')) {
            'low' => 'low',
            'slow' => 'slow',
            default => null,
        };
    }

    public function slowMovingDays(): int
    {
        return $this->filled('slow_days') ? $this->integer('slow_days') : self::DEFAULT_SLOW_MOVING_DAYS;
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
