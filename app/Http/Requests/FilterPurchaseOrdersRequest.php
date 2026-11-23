<?php

namespace App\Http\Requests;

use App\Enums\DeliveryStatus;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

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
            'date_from' => ['bail', 'nullable', 'date_format:Y-m-d', 'before_or_equal:today'],
            'date_to' => ['bail', 'nullable', 'date_format:Y-m-d', 'before_or_equal:today'],
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
            'date_from.before_or_equal' => 'The "From" date cannot be after today.',
            'date_to.before_or_equal' => 'The "To" date cannot be after today.',
        ];
    }

    /**
     * "To before From" is checked only once both days are valid, so a wrong
     * day is not also reported as "To before From".
     *
     * @return array<int, \Closure(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->has('date_from') || $validator->errors()->has('date_to') || ! $this->filled('date_from') || ! $this->filled('date_to')) {
                    return;
                }

                if ((string) $this->input('date_to') < (string) $this->input('date_from')) {
                    $validator->errors()->add('date_to', 'The "To" date cannot be before the "From" date.');
                }
            },
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
