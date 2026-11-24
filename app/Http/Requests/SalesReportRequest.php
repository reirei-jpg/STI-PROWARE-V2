<?php

namespace App\Http\Requests;

use App\Services\Reports\SchoolCalendar;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * The Sales Reports filters, read from the page address: the period
 * (today, this week, this month, this semester, this school year, all time,
 * or From / To days up to today; this month by default, panel revision D2),
 * which tab, and a product search.
 */
class SalesReportRequest extends FormRequest
{
    public const PERIODS = [...SchoolCalendar::PERIODS, 'custom'];

    public const TABS = ['spent', 'sold', 'best', 'options', 'trend', 'free'];

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'period' => ['nullable', Rule::in(self::PERIODS)],
            'date_from' => ['bail', Rule::requiredIf($this->input('period') === 'custom'), 'nullable', 'date_format:Y-m-d', 'before_or_equal:today'],
            'date_to' => ['bail', Rule::requiredIf($this->input('period') === 'custom'), 'nullable', 'date_format:Y-m-d', 'before_or_equal:today'],
            'search' => ['nullable', 'string', 'max:120'],
            'tab' => ['nullable', Rule::in(self::TABS)],
            'details' => ['nullable', 'integer'],
            'only' => ['nullable', Rule::in(['below_cost'])],
            // Stock Trend of one product; every product when empty.
            'product' => ['nullable', 'integer', Rule::exists('products', 'id')],
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
            'period.in' => 'Choose Today, This Week, This Month, This Semester, This School Year, All Time, or From and To days.',
            'date_from.required' => 'Choose the "From" date.',
            'date_to.required' => 'Choose the "To" date.',
            'date_from.date_format' => 'Choose a valid "From" date.',
            'date_to.date_format' => 'Choose a valid "To" date.',
            'date_from.before_or_equal' => 'The "From" date cannot be after today.',
            'date_to.before_or_equal' => 'The "To" date cannot be after today.',
            // e.g. an old link to the Prices tab, now part of Sales.
            'tab.in' => 'Choose Purchases, Sales, Top Sellers, By Size, Color, Grade, Stock Trend or Free Uniforms. Prices are on Sales.',
            'product.integer' => 'Choose a product from the list, or All products.',
            'product.exists' => 'That product was not found. Choose one from the list, or All products.',
            'only.in' => 'That list does not exist. Sales is shown with all products.',
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

    public function period(): string
    {
        return $this->string('period')->toString() ?: SchoolCalendar::DEFAULT_PERIOD;
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
            'custom' => [
                CarbonImmutable::parse($this->string('date_from')->toString())->startOfDay(),
                CarbonImmutable::parse($this->string('date_to')->toString())->endOfDay(),
            ],
            default => [SchoolCalendar::startOf($this->period(), $today), $today->endOfDay()],
        };
    }

    public function search(): ?string
    {
        $search = trim((string) $this->input('search', ''));

        return $search === '' ? null : $search;
    }
}
