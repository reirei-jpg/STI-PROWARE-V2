import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import type { PaymentFilters } from '@/lib/types';

const PERIODS: { value: PaymentFilters['period']; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This week' },
    { value: 'month', label: 'This month' },
    { value: 'custom', label: 'Custom' },
];

/** Today as "YYYY-MM-DD" on this phone. */
function todayIso(): string {
    const now = new Date();

    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** A real calendar day written as YYYY-MM-DD (not 2026-02-30). */
function isRealDay(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/**
 * The period of the cashier's Payment History and Collections on the
 * phone, like the website's: Today, This week, This month, or Custom From /
 * To days typed as YYYY-MM-DD (e.g. 2027-01-01 to 2027-02-28). The days are
 * checked before they are used (a real day, not after today, To not before
 * From, at most one year); the server checks them again.
 */
export default function PaymentPeriodPicker({
    filters,
    onChange,
}: {
    filters: PaymentFilters;
    onChange: (next: Partial<PaymentFilters>) => void;
}) {
    const [custom, setCustom] = useState(filters.period === 'custom');
    const [from, setFrom] = useState(filters.period === 'custom' ? filters.date_from : '');
    const [to, setTo] = useState(filters.period === 'custom' ? filters.date_to : '');
    const [error, setError] = useState<string | null>(null);

    const apply = (): void => {
        const today = todayIso();
        const problem = !isRealDay(from)
            ? 'Enter the "From" date as YYYY-MM-DD, e.g. 2026-11-01.'
            : !isRealDay(to)
              ? 'Enter the "To" date as YYYY-MM-DD, e.g. 2026-11-30.'
              : from > today
                ? 'The "From" date cannot be after today.'
                : to > today
                  ? 'The "To" date cannot be after today.'
                  : to < from
                    ? 'The "To" date cannot be before the "From" date.'
                    : (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000 + 1 > 366
                      ? 'Choose a period of at most one year.'
                      : null;

        setError(problem);

        if (problem === null) {
            onChange({ period: 'custom', date_from: from, date_to: to });
        }
    };

    return (
        <View className="gap-2">
            <View className="flex-row flex-wrap gap-2">
                {PERIODS.map((period) => {
                    const chosen = period.value === 'custom' ? custom : !custom && filters.period === period.value;

                    return (
                        <Pressable
                            key={period.value}
                            onPress={() => {
                                setError(null);

                                if (period.value === 'custom') {
                                    setCustom(true);
                                    setFrom(from || filters.date_from);
                                    setTo(to || filters.date_to);
                                } else {
                                    setCustom(false);
                                    onChange({ period: period.value });
                                }
                            }}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: chosen }}
                            className={`rounded-xl px-3.5 py-2 ${chosen ? 'bg-brand' : 'bg-slate-100'}`}
                        >
                            <Text numberOfLines={1} className={`font-sans-bold text-sm ${chosen ? 'text-white' : 'text-slate-600'}`}>
                                {period.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
            {custom && (
                <View className="gap-2 rounded-2xl border border-slate-200 bg-white p-3">
                    <View className="flex-row gap-2">
                        <View className="flex-1 gap-1">
                            <Text className="font-sans-bold text-xs uppercase text-slate-400">From</Text>
                            <TextInput
                                value={from}
                                onChangeText={setFrom}
                                placeholder="YYYY-MM-DD"
                                placeholderTextColor="#94a3b8"
                                keyboardType="numbers-and-punctuation"
                                maxLength={10}
                                className="h-11 rounded-xl border border-slate-200 px-3 font-sans-bold text-sm text-slate-900"
                            />
                        </View>
                        <View className="flex-1 gap-1">
                            <Text className="font-sans-bold text-xs uppercase text-slate-400">To</Text>
                            <TextInput
                                value={to}
                                onChangeText={setTo}
                                placeholder="YYYY-MM-DD"
                                placeholderTextColor="#94a3b8"
                                keyboardType="numbers-and-punctuation"
                                maxLength={10}
                                className="h-11 rounded-xl border border-slate-200 px-3 font-sans-bold text-sm text-slate-900"
                            />
                        </View>
                    </View>
                    {error && <Text className="font-sans-semibold text-sm text-red-600">{error}</Text>}
                    <Pressable onPress={apply} accessibilityRole="button" className="items-center rounded-xl bg-brand py-2.5">
                        <Text className="font-sans-bold text-sm text-white">Show this period</Text>
                    </Pressable>
                </View>
            )}
        </View>
    );
}

/** The filters as the address query the server reads. */
/**
 * What a summary card opens: Payment History for a period, showing only
 * Cash, GCash, paid or voided receipts (the receipts behind the card).
 */
export function receiptsLink(
    period: Pick<PaymentFilters, 'period' | 'date_from' | 'date_to'>,
    method: PaymentFilters['method'],
    status: PaymentFilters['status'],
): { pathname: '/cashier-history'; params: Record<string, string> } {
    const params: Record<string, string> = { period: period.period, method, status };

    if (period.period === 'custom') {
        params.date_from = period.date_from;
        params.date_to = period.date_to;
    }

    return { pathname: '/cashier-history', params };
}

/** The filters a card sent to Payment History; anything unknown is left out. */
export function filtersFromLink(
    start: PaymentFilters,
    params: { period?: string | string[]; date_from?: string | string[]; date_to?: string | string[]; method?: string | string[]; status?: string | string[] },
): PaymentFilters {
    const read = (value: string | string[] | undefined): string => (Array.isArray(value) ? (value[0] ?? '') : (value ?? ''));
    const period = read(params.period);
    const method = read(params.method);
    const status = read(params.status);
    const custom = period === 'custom' && isRealDay(read(params.date_from)) && isRealDay(read(params.date_to));

    return {
        ...start,
        period: PERIODS.some((option) => option.value === period) && (period !== 'custom' || custom) ? (period as PaymentFilters['period']) : start.period,
        date_from: custom ? read(params.date_from) : '',
        date_to: custom ? read(params.date_to) : '',
        method: method === 'cash' || method === 'gcash' ? method : '',
        status: status === 'paid' || status === 'void' ? status : '',
    };
}

export function paymentQuery(filters: PaymentFilters, page = 1): string {
    const query = new URLSearchParams({ period: filters.period });

    if (filters.period === 'custom') {
        query.set('date_from', filters.date_from);
        query.set('date_to', filters.date_to);
    }

    for (const key of ['method', 'type', 'status', 'search'] as const) {
        if (filters[key] !== '') {
            query.set(key, filters[key]);
        }
    }

    query.set('group', filters.group);
    query.set('page', String(page));

    return query.toString();
}
