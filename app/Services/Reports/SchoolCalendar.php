<?php

namespace App\Services\Reports;

use Carbon\CarbonImmutable;

/**
 * The report periods the panel asked for (daily, monthly, semester, school
 * year), all ending today, so totals are never shown without a date range.
 * The school year starts on August 1: the 1st semester is August to
 * December, the 2nd January to July (summer included).
 */
final class SchoolCalendar
{
    public const SCHOOL_YEAR_STARTS_MONTH = 8;

    /** The periods shared by the Sales Reports and the School Admin's sales, This Month first chosen. */
    public const PERIODS = ['today', 'week', 'month', 'semester', 'school_year', 'all'];

    public const DEFAULT_PERIOD = 'month';

    /**
     * The first day of the period that ends today.
     */
    public static function startOf(string $period, ?CarbonImmutable $today = null): CarbonImmutable
    {
        $today ??= CarbonImmutable::now();

        return match ($period) {
            'today' => $today->startOfDay(),
            'week' => $today->startOfWeek(),
            'month' => $today->startOfMonth(),
            'semester' => $today->month >= self::SCHOOL_YEAR_STARTS_MONTH
                ? $today->setDate($today->year, self::SCHOOL_YEAR_STARTS_MONTH, 1)->startOfDay()
                : $today->setDate($today->year, 1, 1)->startOfDay(),
            'school_year' => $today->setDate(
                $today->month >= self::SCHOOL_YEAR_STARTS_MONTH ? $today->year : $today->year - 1,
                self::SCHOOL_YEAR_STARTS_MONTH,
                1,
            )->startOfDay(),
            default => SalesReport::firstDay(),
        };
    }
}
