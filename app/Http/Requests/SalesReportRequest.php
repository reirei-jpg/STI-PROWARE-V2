<?php

namespace App\Http\Requests;

use App\Services\Reports\PriceList;
use App\Services\Reports\SalesReport;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * The Sales Reports filters, read from the page address: the period
 * (all time, today, this week, this month, or chosen dates; all time by
 * default, so every sale shows),
 * which tab, a product search, and on Prices which products to show.
 */
class SalesReportRequest extends FormRequest
{
    public const PERIODS = ['all', 'today', 'week', 'month', 'custom'];

    public const TABS = ['spent', 'sold', 'best', 'free', 'prices'];

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'period' => ['nullable', Rule::in(self::PERIODS)],
            'date_from' => ['nullable', 'date_format:Y-m-d', Rule::requiredIf($this->input('period') === 'custom')],
            'date_to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:date_from', Rule::requiredIf($this->input('period') === 'custom')],
            'search' => ['nullable', 'string', 'max:120'],
            'tab' => ['nullable', Rule::in(self::TABS)],
            'show' => ['nullable', Rule::in(PriceList::SHOW)],
        ];
    }

    /**
     * What we spent (eStore orders), What we sold, Given free; What we sold
     * by default.
     */
    public function tab(): string
    {
        return $this->string('tab')->toString() ?: 'sold';
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'date_from.required' => 'Choose the "From" date.',
            'date_to.required' => 'Choose the "To" date.',
            'date_from.date_format' => 'Choose a valid "From" date.',
            'date_to.date_format' => 'Choose a valid "To" date.',
            'date_to.after_or_equal' => 'The "To" date cannot be before the "From" date.',
        ];
    }

    public function period(): string
    {
        return $this->string('period')->toString() ?: 'all';
    }

    /**
     * The first and last day of the period.
     *
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}
     */
    public function range(): array
    {
        $today = CarbonImmutable::now();

        return match ($this->period()) {
            'today' => [$today->startOfDay(), $today->endOfDay()],
            'week' => [$today->startOfWeek(), $today->endOfDay()],
            'custom' => [
                CarbonImmutable::parse($this->string('date_from')->toString())->startOfDay(),
                CarbonImmutable::parse($this->string('date_to')->toString())->endOfDay(),
            ],
            'month' => [$today->startOfMonth(), $today->endOfDay()],
            default => [SalesReport::firstDay(), $today->endOfDay()],
        };
    }

    /**
     * Prices: every product, those selling below cost, or those whose
     * eStore price changed.
     */
    public function priceFilter(): string
    {
        return $this->string('show')->toString() ?: 'all';
    }

    public function search(): ?string
    {
        $search = trim((string) $this->input('search', ''));

        return $search === '' ? null : $search;
    }
}
