import { ArrowRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import BottomSheet from '@/components/BottomSheet';
import LoadError from '@/components/LoadError';
import PaymentRowItem from '@/components/PaymentRowItem';
import { loadErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatPeso, receiptCount } from '@/lib/format';
import type { Page, PaymentFilters, PaymentRow, PaymentTotals } from '@/lib/types';

/** How many receipts the sheet lists; the rest are in Payment History. */
const SHOWN = 10;

/** What a summary card opens: its receipts for a period. */
export type PaymentListRequest = {
    title: string;
    icon: ReactNode;
    /** The Payment History filters, as query text (paymentQuery). */
    query: string;
    /** Voided receipts show the voided amount; the others the amount collected. */
    voided?: boolean;
    /** Show the Cash / GCash split under the total. */
    split?: boolean;
    /** Shown when there is no receipt. */
    empty: string;
    /** The button at the bottom, e.g. Open Payment History. */
    action: { label: string; onPress: () => void };
};

type Answer = { payments: Page<PaymentRow>; totals: PaymentTotals; filters: PaymentFilters };

/**
 * The pop-up a cashier summary card opens on the phone, like the website's
 * and V1's: the total and the latest receipts behind the card (tap one to
 * open it), then a button to see them all. A list that cannot be loaded
 * says why, with Try again.
 */
export default function PaymentListSheet({ request, onClose }: { request: PaymentListRequest | null; onClose: () => void }) {
    const { request: api } = useAuth();
    const [answer, setAnswer] = useState<Answer | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (): Promise<void> => {
        if (request === null) {
            return;
        }

        setAnswer(null);
        setError(null);

        try {
            setAnswer(await api<Answer>(`/cashier/payments?${request.query}`));
        } catch (caught) {
            setError(loadErrorMessage(caught, 'The receipts could not be loaded.'));
        }
    }, [api, request]);

    useEffect(() => {
        void load();
    }, [load]);

    const totals = answer?.totals;
    const rows = answer?.payments.data.slice(0, SHOWN) ?? [];
    const more = answer ? answer.payments.total - rows.length : 0;

    return (
        <BottomSheet
            open={request !== null}
            onClose={onClose}
            title={request?.title ?? ''}
            subtitle={answer ? periodText(answer.filters) : error === null ? 'Loading…' : 'Could not load'}
            icon={request?.icon}
            footer={
                <View className="gap-2">
                    {more > 0 && (
                        <Text className="text-center font-sans text-xs text-slate-500">
                            The latest {rows.length} are shown, and {more} more.
                        </Text>
                    )}
                    <Pressable
                        onPress={() => {
                            onClose();
                            request?.action.onPress();
                        }}
                        accessibilityRole="button"
                        className="flex-row items-center justify-center gap-2 rounded-2xl bg-brand py-3.5"
                    >
                        <Text className="font-sans-bold text-base text-white">{request?.action.label}</Text>
                        <ArrowRight size={18} color="#ffffff" />
                    </Pressable>
                </View>
            }
        >
            {error ? (
                <LoadError message={error} onRetry={load} className="" />
            ) : answer === null || totals === undefined ? (
                <View className="items-center gap-2 py-8">
                    <ActivityIndicator color="#0D6EFD" />
                    <Text className="font-sans text-sm text-slate-500">Loading the receipts…</Text>
                </View>
            ) : (
                <>
                    <View>
                        <Text className={`font-sans-bold text-3xl ${request?.voided ? 'text-red-700' : 'text-slate-900'}`}>
                            {formatPeso(request?.voided ? totals.void_centavos : totals.total_centavos)}
                        </Text>
                        <Text className="mt-1 font-sans text-sm text-slate-500">
                            {request?.voided ? `${receiptCount(totals.void_count)} voided, not counted in the total` : `${receiptCount(totals.count)} collected`}
                        </Text>
                        {request?.split && (
                            <View className="mt-2 flex-row flex-wrap gap-2">
                                <Text className="rounded-lg bg-slate-100 px-2.5 py-1 font-sans-bold text-sm text-slate-700">
                                    Cash {formatPeso(totals.cash_centavos)}
                                </Text>
                                <Text className="rounded-lg bg-slate-100 px-2.5 py-1 font-sans-bold text-sm text-slate-700">
                                    GCash {formatPeso(totals.gcash_centavos)}
                                </Text>
                            </View>
                        )}
                    </View>

                    {rows.length === 0 ? (
                        <Text className="rounded-2xl border border-slate-200 px-4 py-6 text-center font-sans text-sm text-slate-500">{request?.empty}</Text>
                    ) : (
                        <View className="overflow-hidden rounded-2xl border border-slate-200">
                            {rows.map((row, index) => (
                                <PaymentRowItem key={row.id} row={row} first={index === 0} detail={detailOf(row)} onOpen={onClose} />
                            ))}
                        </View>
                    )}
                </>
            )}
        </BottomSheet>
    );
}

/** The change given or the GCash reference. */
function detailOf(row: PaymentRow): string {
    return row.method === 'cash'
        ? `Received ${formatPeso(row.amount_received_centavos)} · Change ${formatPeso(row.change_centavos)}`
        : `GCash reference ${row.gcash_reference ?? '—'}`;
}

/** "Today", "This week", "This month" or "Nov 1, 2026 to Nov 20, 2026". */
export function periodText(filters: Pick<PaymentFilters, 'period' | 'date_from' | 'date_to'>): string {
    if (filters.period === 'today') {
        return 'Today';
    }

    if (filters.period === 'week') {
        return 'This week';
    }

    if (filters.period === 'month') {
        return 'This month';
    }

    const day = (value: string): string => {
        const [year, month, date] = value.split('-').map(Number);

        return new Date(year, month - 1, date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return filters.date_from === filters.date_to ? day(filters.date_from) : `${day(filters.date_from)} to ${day(filters.date_to)}`;
}
