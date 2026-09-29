import { CalendarDays, X } from 'lucide-react';
import { useState } from 'react';
import InputError from '@/components/input-error';

const inputClasses =
    'h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100';

/**
 * A "From" / "To" date filter. Each field opens the browser's drop-down
 * calendar. A "To" date before the "From" date is refused here (the server
 * checks it too), so the list is never asked for an impossible range.
 */
export default function DateRangeFilter({
    label,
    dateFrom,
    dateTo,
    serverError,
    onChange,
}: {
    label: string;
    dateFrom: string | null;
    dateTo: string | null;
    serverError?: string;
    onChange: (dateFrom: string | null, dateTo: string | null) => void;
}) {
    const [error, setError] = useState<string | null>(null);

    const change = (from: string | null, to: string | null) => {
        if (from !== null && to !== null && to < from) {
            setError('The "To" date cannot be before the "From" date.');

            return;
        }

        setError(null);
        onChange(from, to);
    };

    const hasDates = dateFrom !== null || dateTo !== null;

    return (
        <div>
            <div className="flex flex-wrap items-end gap-3">
                <div className="flex items-center gap-2 self-center text-sm font-black text-slate-700">
                    <CalendarDays size={18} className="text-blue-600" />
                    {label}
                </div>

                <label className="grid gap-1">
                    <span className="text-xs font-bold tracking-wide text-slate-400 uppercase">
                        From
                    </span>
                    <input
                        type="date"
                        value={dateFrom ?? ''}
                        max={dateTo ?? undefined}
                        onChange={(event) =>
                            change(event.target.value || null, dateTo)
                        }
                        className={inputClasses}
                        aria-label={`${label} from`}
                    />
                </label>

                <label className="grid gap-1">
                    <span className="text-xs font-bold tracking-wide text-slate-400 uppercase">
                        To
                    </span>
                    <input
                        type="date"
                        value={dateTo ?? ''}
                        min={dateFrom ?? undefined}
                        onChange={(event) =>
                            change(dateFrom, event.target.value || null)
                        }
                        className={inputClasses}
                        aria-label={`${label} to`}
                    />
                </label>

                {hasDates && (
                    <button
                        type="button"
                        onClick={() => change(null, null)}
                        className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
                    >
                        <X size={16} />
                        Clear filters
                    </button>
                )}
            </div>

            <InputError message={error ?? serverError} className="mt-2" />
        </div>
    );
}
