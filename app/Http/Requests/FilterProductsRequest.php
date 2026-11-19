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
            // Slow-moving: the last week, month or year, or From – To days picked on the calendar,
            'slow' => ['nullable', 'in:week,month,year,range'],
            'slow_from' => ['nullable', 'required_if:slow,range', 'date_format:Y-m-d', 'before_or_equal:today'],
            'slow_to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:slow_from', 'before_or_equal:today'],
            // and how slow: all slow (5 sold or fewer), no sales, 1–2 sold, or 3–5 sold.
            'sold' => ['nullable', 'in:all,none,few,some'],
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
            'slow_from.required_if' => 'Pick the From day on the calendar.',
            'slow_from.date_format' => 'Pick a valid From day.',
            'slow_from.before_or_equal' => 'The From day cannot be in the future.',
            'slow_to.date_format' => 'Pick a valid To day.',
            'slow_to.after_or_equal' => 'The To day cannot be before the From day.',
            'slow_to.before_or_equal' => 'The To day cannot be in the future.',
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

    /** At most this many pieces sold in the time chosen: slow-moving. */
    public const SLOW_MOST_SOLD = 5;

    /**
     * Which time the Slow-moving list is for: 1 week, 1 month (the first
     * one shown), 1 year, or From – To days picked on the calendar. A link
     * with a number of days (from the Dashboard) keeps that number.
     *
     * @return 'week'|'month'|'year'|'range'|'days'
     */
    public function slowChoice(): string
    {
        if ($this->filled('slow_days') && ! $this->filled('slow')) {
            return 'days';
        }

        return match ($this->input('slow')) {
            'week' => 'week',
            'year' => 'year',
            'range' => $this->filled('slow_from') ? 'range' : 'month',
            default => 'month',
        };
    }

    /**
     * The Slow-moving time, from its first moment to its last.
     *
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}
     */
    public function slowPeriod(): array
    {
        $now = CarbonImmutable::now();

        return match ($this->slowChoice()) {
            'days' => [$now->subDays($this->slowMovingDays()), $now],
            'week' => [$now->subWeek(), $now],
            'year' => [$now->subYear(), $now],
            'range' => [
                CarbonImmutable::parse((string) $this->input('slow_from'))->startOfDay(),
                $this->filled('slow_to') ? CarbonImmutable::parse((string) $this->input('slow_to'))->endOfDay() : $now,
            ],
            default => [$now->subMonth(), $now],
        };
    }

    /**
     * How slow: all slow (5 sold or fewer, the first shown), no sales,
     * 1–2 sold, or 3–5 sold. A Dashboard link with a number of days means
     * no sales.
     *
     * @return 'all'|'none'|'few'|'some'
     */
    public function soldChoice(): string
    {
        if ($this->slowChoice() === 'days' && ! $this->filled('sold')) {
            return 'none';
        }

        return match ($this->input('sold')) {
            'none' => 'none',
            'few' => 'few',
            'some' => 'some',
            default => 'all',
        };
    }

    /**
     * The fewest and most pieces sold for the choice.
     *
     * @return array{0: int, 1: int}
     */
    public function soldRange(): array
    {
        return match ($this->soldChoice()) {
            'none' => [0, 0],
            'few' => [1, 2],
            'some' => [3, self::SLOW_MOST_SOLD],
            default => [0, self::SLOW_MOST_SOLD],
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
