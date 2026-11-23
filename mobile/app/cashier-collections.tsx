import { router } from 'expo-router';
import { ArrowLeft, Banknote, ChevronRight, ReceiptText, Smartphone, XCircle } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LoadError from '@/components/LoadError';
import PaymentListSheet from '@/components/PaymentListSheet';
import type { PaymentListRequest } from '@/components/PaymentListSheet';
import PaymentPeriodPicker, { paymentQuery, receiptsLink } from '@/components/PaymentPeriodPicker';
import { loadErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatPeso, receiptCount } from '@/lib/format';
import type { CollectionRow, PaymentFilters, PaymentTotals } from '@/lib/types';

type CollectionsAnswer = { totals: PaymentTotals; rows: CollectionRow[]; filters: PaymentFilters };

const START: PaymentFilters = { period: 'month', date_from: '', date_to: '', method: '', type: '', status: '', search: '', group: 'day' };

/**
 * Collections on the phone, like the website's: the money collected in a
 * period (this month by default, or any From / To days, e.g. January to
 * February), by day or by month, in Cash and GCash; voided payments are not
 * counted. Tapping a total opens its receipts for the same period in a
 * pop-up, with a button to Payment History. The daily report and the Excel download are on the
 * website.
 */
export default function CashierCollectionsScreen() {
    const insets = useSafeAreaInsets();
    const { request } = useAuth();
    const [filters, setFilters] = useState<PaymentFilters>(START);
    const [answer, setAnswer] = useState<CollectionsAnswer | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(
        async (next: PaymentFilters): Promise<void> => {
            setLoading(true);
            setError(null);

            try {
                const result = await request<CollectionsAnswer>(`/cashier/collections?${paymentQuery(next)}`);
                setAnswer(result);
                setFilters(result.filters);
            } catch (caught) {
                setError(loadErrorMessage(caught, 'The collections could not be loaded.'));
            } finally {
                setLoading(false);
            }
        },
        [request],
    );

    useEffect(() => {
        void load(START);
    }, [load]);

    const show = (next: Partial<PaymentFilters>): void => void load({ ...filters, ...next });
    const totals = answer?.totals;
    const [sheet, setSheet] = useState<PaymentListRequest | null>(null);

    /** A total's pop-up: the receipts behind it for this same period, and a button to Payment History. */
    const openReceipts = (
        method: PaymentFilters['method'],
        status: PaymentFilters['status'],
        title: string,
        icon: ReactNode,
        empty: string,
        extra: Partial<PaymentListRequest> = {},
    ): void =>
        setSheet({
            title,
            icon,
            query: paymentQuery({ ...filters, method, status, type: '', search: '', group: 'day' }),
            empty,
            action: { label: 'Open Payment History', onPress: () => router.push(receiptsLink(filters, method, status)) },
            ...extra,
        });

    return (
        <ScrollView
            className="flex-1 bg-page"
            contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32, paddingHorizontal: 16, gap: 14 }}
            keyboardShouldPersistTaps="handled"
        >
            <Pressable
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/cashier'))}
                accessibilityRole="button"
                className="flex-row items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
                <ArrowLeft size={17} color="#334155" />
                <Text className="font-sans-bold text-sm text-slate-700">Back</Text>
            </Pressable>

            <View>
                <Text className="font-sans-bold text-2xl text-slate-900">Collections</Text>
                <Text className="mt-1 font-sans text-sm text-slate-500">
                    The money collected for PROWARE. The daily report and the Excel download are on the website.
                </Text>
            </View>

            <PaymentPeriodPicker filters={filters} onChange={show} />

            <View className="flex-row gap-2">
                {(
                    [
                        ['day', 'By day'],
                        ['month', 'By month'],
                    ] as const
                ).map(([value, label]) => (
                    <Pressable
                        key={value}
                        onPress={() => show({ group: value })}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: filters.group === value }}
                        className={`rounded-xl px-3.5 py-2 ${filters.group === value ? 'bg-slate-900' : 'bg-slate-100'}`}
                    >
                        <Text className={`font-sans-bold text-sm ${filters.group === value ? 'text-white' : 'text-slate-600'}`}>{label}</Text>
                    </Pressable>
                ))}
            </View>

            {totals && (
                <>
                    <Pressable onPress={() => openReceipts('', 'paid', 'Total Collected', <ReceiptText size={20} color="#1d4ed8" />, 'No payments were recorded in this period.', { split: true })} accessibilityRole="button" className="gap-1 rounded-3xl bg-brand p-4">
                        <Text className="font-sans-semibold text-xs uppercase text-blue-100">Total collected</Text>
                        <Text className="font-sans-bold text-3xl text-white">{formatPeso(totals.total_centavos)}</Text>
                        <View className="flex-row items-center justify-between gap-2">
                            <Text className="font-sans text-sm text-blue-50">{receiptCount(totals.count)} in this period</Text>
                            <View className="flex-row items-center gap-0.5">
                                <Text className="font-sans-bold text-xs text-white">View receipts</Text>
                                <ChevronRight size={14} color="#ffffff" />
                            </View>
                        </View>
                    </Pressable>
                    <View className="flex-row gap-2">
                        <Tile label="Cash" value={formatPeso(totals.cash_centavos)} detail={receiptCount(totals.cash_count)} onPress={() => openReceipts('cash', 'paid', 'Cash Payments', <Banknote size={20} color="#1d4ed8" />, 'No cash payments were recorded in this period.')} />
                        <Tile label="GCash" value={formatPeso(totals.gcash_centavos)} detail={receiptCount(totals.gcash_count)} onPress={() => openReceipts('gcash', 'paid', 'GCash Payments', <Smartphone size={20} color="#1d4ed8" />, 'No GCash payments were recorded in this period.')} />
                        <Tile label="Voided" value={formatPeso(totals.void_centavos)} detail={`${receiptCount(totals.void_count)}, not counted`} onPress={() => openReceipts('', 'void', 'Voided Payments', <XCircle size={20} color="#b91c1c" />, 'No payments were voided in this period.', { voided: true })} />
                    </View>
                </>
            )}

            {error ? (
                <LoadError message={error} onRetry={() => load(filters)} className="" />
            ) : answer === null ? (
                <ActivityIndicator color="#0D6EFD" />
            ) : answer.rows.length === 0 ? (
                <Text className="rounded-3xl border border-slate-200 bg-white px-4 py-8 text-center font-sans text-sm text-slate-500">
                    No payments were recorded in this period.
                </Text>
            ) : (
                <View className={`overflow-hidden rounded-3xl border border-slate-200 bg-white ${loading ? 'opacity-60' : ''}`}>
                    {answer.rows.map((row, index) => (
                        <View key={row.period} className={`gap-0.5 px-4 py-3 ${index > 0 ? 'border-t border-slate-100' : ''}`}>
                            <View className="flex-row items-center justify-between">
                                <Text className="font-sans-bold text-sm text-slate-900">{row.label}</Text>
                                <Text className="font-sans-bold text-sm text-slate-900">{formatPeso(row.total_centavos)}</Text>
                            </View>
                            <Text className="font-sans text-xs text-slate-500">
                                {row.count} {row.count === 1 ? 'payment' : 'payments'} · Cash {formatPeso(row.cash_centavos)} · GCash{' '}
                                {formatPeso(row.gcash_centavos)}
                                {row.void_count > 0 ? ` · ${row.void_count} voided` : ''}
                            </Text>
                        </View>
                    ))}
                </View>
            )}
            <PaymentListSheet request={sheet} onClose={() => setSheet(null)} />
        </ScrollView>
    );
}

function Tile({ label, value, detail, onPress }: { label: string; value: string; detail: string; onPress: () => void }) {
    return (
        <Pressable onPress={onPress} accessibilityRole="button" className="flex-1 rounded-2xl border border-slate-200 bg-white p-3 active:bg-blue-50">
            <Text className="font-sans-bold text-[11px] text-slate-500">{label}</Text>
            <Text className="font-sans-bold text-sm text-slate-900">{value}</Text>
            <Text className="font-sans text-[11px] text-slate-500">{detail}</Text>
            <Text className="mt-1 font-sans-bold text-[11px] text-blue-700">View</Text>
        </Pressable>
    );
}
