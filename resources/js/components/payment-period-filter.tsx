import { CalendarDays, X } from 'lucide-react';
import InputError from '@/components/input-error';
import { monthBefore, todayIso } from '@/lib/dates';
import { formatDateOrdered } from '@/lib/format';
import { openCalendar } from '@/lib/open-calendar';
import { cn } from '@/lib/utils';
import type { PaymentFilters, PaymentPeriod } from '@/types';

const periods: { value: Exclude<PaymentPeriod, 'custom'>; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This week' },
    { value: 'month', label: 'This month' },
];

/**
 * The period of the cashier's Payment History and Collections, as on Sales
 * Reports: Today, This week, This month, or From / To days (e.g. January 1
 * to February 28). Days after today cannot be picked, and "To" cannot be
 * before "From"; the server checks it again (at most one year).
 */
export default function PaymentPeriodFilter({
    filters,
    clearTo,
    error,
    onChange,
}: {
    filters: PaymentFilters;
    /** The period that clearing the dates goes back to. */
    clearTo: Exclude<PaymentPeriod, 'custom'>;
    error?: string;
    onChange: (next: Partial<PaymentFilters>) => void;
}) {
    const pickedDates = filters.period === 'custom';
    const today = todayIso();
    const periodText =
        filters.date_from === filters.date_to
            ? formatDateOrdered(filters.date_from)
            : `${formatDateOrdered(filters.date_from)} to ${formatDateOrdered(filters.date_to)}`;

    return (
        <div>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                    {periods.map((period) => (
                        <button
                            key={period.value}
                            type="button"
                            onClick={() => onChange({ period: period.value })}
                            aria-pressed={filters.period === period.value}
                            className={cn(
                                'rounded-xl px-4 py-2.5 text-sm font-black transition',
                                filters.period === period.value
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                            )}
                        >
                            {period.label}
                        </button>
                    ))}
                    <span
                        className={cn(
                            'inline-flex flex-wrap items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-black',
                            pickedDates
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 text-slate-600',
                        )}
                    >
                        <CalendarDays size={16} />
                        <label className="inline-flex cursor-pointer items-center gap-2">
                            From
                            <input
                                type="date"
                                onClick={openCalendar}
                                value={pickedDates ? filters.date_from : ''}
                                max={pickedDates ? filters.date_to : today}
                                onChange={(event) =>
                                    event.target.value !== '' &&
                                    onChange({
                                        period: 'custom',
                                        date_from: event.target.value,
                                        // Picked alone: up to today.
                                        date_to:
                                            pickedDates &&
                                            filters.date_to >=
                                                event.target.value
                                                ? filters.date_to
                                                : today,
                                    })
                                }
                                aria-label="From this day"
                                className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-bold text-slate-800 outline-none"
                            />
                        </label>
                        <label className="inline-flex cursor-pointer items-center gap-2">
                            To
                            <input
                                type="date"
                                onClick={openCalendar}
                                value={pickedDates ? filters.date_to : ''}
                                min={
                                    pickedDates ? filters.date_from : undefined
                                }
                                max={today}
                                onChange={(event) =>
                                    event.target.value !== '' &&
                                    onChange({
                                        period: 'custom',
                                        // Picked first: From is one month before, to change if needed.
                                        date_from:
                                            pickedDates &&
                                            filters.date_from <=
                                                event.target.value
                                                ? filters.date_from
                                                : monthBefore(
                                                      event.target.value,
                                                  ),
                                        date_to: event.target.value,
                                    })
                                }
                                aria-label="To this day"
                                className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-bold text-slate-800 outline-none"
                            />
                        </label>
                        {pickedDates && (
                            <button
                                type="button"
                                onClick={() => onChange({ period: clearTo })}
                                className="inline-flex size-7 items-center justify-center rounded-lg bg-white/20 transition hover:bg-white/30"
                                aria-label="Clear the dates"
                                title="Clear the dates"
                            >
                                <X size={15} />
                            </button>
                        )}
                    </span>
                </div>
                <p className="text-base font-black text-slate-900">
                    {periodText}
                </p>
            </div>
            <InputError className="mt-2 font-semibold" message={error} />
        </div>
    );
}

/**
 * The filters as a page address query: only what differs from the defaults.
 */
export function paymentQuery(
    filters: PaymentFilters,
    defaultPeriod: Exclude<PaymentPeriod, 'custom'>,
): Record<string, string> {
    const query: Record<string, string> = {};

    if (filters.period !== defaultPeriod) {
        query.period = filters.period;
    }

    if (filters.period === 'custom') {
        query.date_from = filters.date_from;
        query.date_to = filters.date_to;
    }

    for (const key of ['method', 'type', 'status', 'search'] as const) {
        if (filters[key] !== '') {
            query[key] = filters[key];
        }
    }

    if (filters.group !== 'day') {
        query.group = filters.group;
    }

    return query;
}
