<?php

namespace App\Http\Requests;

use App\Services\Reports\SalesReport;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * The Sales Reports filters, read from the page address: the period
 * (all time, today, this week, this month, or From / To days up to today;
 * all time by default, so every sale shows),
 * which tab, and a product search.
 */
class SalesReportRequest extends FormRequest
{
    public const PERIODS = ['all', 'today', 'week', 'month', 'custom'];

    public const TABS = ['spent', 'sold', 'best', 'free'];

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'period' => ['nullable', Rule::in(self::PERIODS)],
            'date_from' => ['nullable', 'date_format:Y-m-d', 'before_or_equal:today', Rule::requiredIf($this->input('period') === 'custom')],
            'date_to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:date_from', 'before_or_equal:today', Rule::requiredIf($this->input('period') === 'custom')],
            'search' => ['nullable', 'string', 'max:120'],
            'tab' => ['nullable', Rule::in(self::TABS)],
            'details' => ['nullable', 'integer'],
            'only' => ['nullable', Rule::in(['below_cost'])],
        ];
    }

    /**
     * Sales showing only the products sold below cost (the Loss on
     * Below-Cost Sales card).
     */
    public function onlyBelowCost(): bool
    {
        return $this->input('only') === 'below_cost';
    }

    /**
     * Purchases (eStore orders), Sales, Top Sellers, Free Uniforms; Sales
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
            'date_from.before_or_equal' => 'The "From" date cannot be after today.',
            'date_to.before_or_equal' => 'The "To" date cannot be after today.',
            // e.g. an old link to the Prices tab, now part of Sales.
            'tab.in' => 'Choose Purchases, Sales, Top Sellers or Free Uniforms. Prices are on Sales.',
            'only.in' => 'That list does not exist. Sales is shown with all products.',
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

    public function search(): ?string
    {
        $search = trim((string) $this->input('search', ''));

        return $search === '' ? null : $search;
    }
}
