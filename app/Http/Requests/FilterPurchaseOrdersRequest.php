<?php

namespace App\Http\Requests;

use App\Enums\DeliveryStatus;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * The filters on the Purchase Orders list, read from the page address.
 */
class FilterPurchaseOrdersRequest extends FormRequest
{
    public const SORTS = ['oldest_waiting', 'newest'];

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'search' => ['nullable', 'string', 'max:40'],
            'category' => ['nullable', 'string', 'max:120'],
            'status' => ['nullable', Rule::enum(DeliveryStatus::class)],
            'sort' => ['nullable', Rule::in(self::SORTS)],
            'date_from' => ['nullable', 'date_format:Y-m-d'],
            'date_to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:date_from'],
            'view' => ['nullable', 'integer'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'date_from.date_format' => 'Choose a valid "From" date.',
            'date_to.date_format' => 'Choose a valid "To" date.',
            'date_to.after_or_equal' => 'The "To" date cannot be before the "From" date.',
        ];
    }

    /**
     * The Order # being searched for; "#30722" and "30722" both work.
     */
    public function search(): ?string
    {
        $search = trim(ltrim(trim((string) $this->input('search', '')), '#'));

        return $search === '' ? null : $search;
    }

    public function status(): ?DeliveryStatus
    {
        return $this->filled('status') ? DeliveryStatus::from((string) $this->input('status')) : null;
    }

    /**
     * How the list is ordered: "oldest_waiting" (orders still waiting first,
     * oldest at the top; the default) or "newest" (newest Date Ordered first).
     */
    public function sort(): string
    {
        $sort = (string) $this->input('sort', '');

        return in_array($sort, self::SORTS, true) ? $sort : 'oldest_waiting';
    }

    public function category(): ?string
    {
        return $this->filled('category') ? trim($this->string('category')->toString()) : null;
    }

    public function dateFrom(): ?string
    {
        return $this->filled('date_from') ? $this->string('date_from')->toString() : null;
    }

    public function dateTo(): ?string
    {
        return $this->filled('date_to') ? $this->string('date_to')->toString() : null;
    }
}
