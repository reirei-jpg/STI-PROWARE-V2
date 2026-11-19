<?php

namespace App\Http\Requests;

use App\Enums\ProductStatus;
use Carbon\CarbonImmutable;
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
            'stock' => ['nullable', 'in:low,out,slow'],
            'slow_days' => ['nullable', 'integer', 'min:1', 'max:365'],
            // No sale in the last week, month or year, or since a day picked on the calendar.
            'slow' => ['nullable', 'in:week,month,year,date'],
            'slow_since' => ['nullable', 'required_if:slow,date', 'date_format:Y-m-d', 'before_or_equal:today'],
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
            'slow_since.required_if' => 'Pick the day on the calendar.',
            'slow_since.date_format' => 'Pick a valid day.',
            'slow_since.before_or_equal' => 'The day cannot be in the future.',
        ];
    }

    /**
     * Low stock (a few pieces left), Out of stock (none left) or
     * Slow-moving.
     *
     * @return 'low'|'out'|'slow'|null
     */
    public function stockFilter(): ?string
    {
        return match ($this->input('stock')) {
            'low' => 'low',
            'out' => 'out',
            'slow' => 'slow',
            default => null,
        };
    }

    public function slowMovingDays(): int
    {
        return $this->filled('slow_days') ? $this->integer('slow_days') : self::DEFAULT_SLOW_MOVING_DAYS;
    }

    /**
     * Which time the Slow-moving list is for: 1 week, 1 month (the first
     * one shown), 1 year, or a day picked on the calendar. A link with a
     * number of days (from the Dashboard) keeps that number.
     *
     * @return 'week'|'month'|'year'|'date'|'days'
     */
    public function slowChoice(): string
    {
        if ($this->filled('slow_days') && ! $this->filled('slow')) {
            return 'days';
        }

        return match ($this->input('slow')) {
            'week' => 'week',
            'year' => 'year',
            'date' => $this->filled('slow_since') ? 'date' : 'month',
            default => 'month',
        };
    }

    /**
     * The start of the Slow-moving time: products that sold nothing since.
     */
    public function slowSince(): CarbonImmutable
    {
        return match ($this->slowChoice()) {
            'days' => CarbonImmutable::now()->subDays($this->slowMovingDays()),
            'week' => CarbonImmutable::now()->subWeek(),
            'year' => CarbonImmutable::now()->subYear(),
            'date' => CarbonImmutable::parse((string) $this->input('slow_since'))->startOfDay(),
            default => CarbonImmutable::now()->subMonth(),
        };
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
