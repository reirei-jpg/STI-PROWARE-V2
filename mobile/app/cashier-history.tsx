import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Banknote, ReceiptText, Search, Smartphone, XCircle } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LoadError from '@/components/LoadError';
import PaymentPeriodPicker, { filtersFromLink, paymentQuery } from '@/components/PaymentPeriodPicker';
import PaymentListSheet from '@/components/PaymentListSheet';
import type { PaymentListRequest } from '@/components/PaymentListSheet';
import PaymentRowItem from '@/components/PaymentRowItem';
import { loadErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatPeso, receiptCount } from '@/lib/format';
import type { Page, PaymentFilters, PaymentRow, PaymentTotals } from '@/lib/types';

type HistoryPage = { payments: Page<PaymentRow>; totals: PaymentTotals; filters: PaymentFilters };

const START: PaymentFilters = { period: 'today', date_from: '', date_to: '', method: '', type: '', status: '', search: '', group: 'day' };

/**
 * Payment History on the phone, like the website's: every Payment Receipt,
 * today first by default. Filter by period, method, Order or Preorder, Paid
 * or Voided, and search by receipt, slip number, buyer name or ID, or GCash
 * reference. The totals are of everything that matches; tapping a total
 * opens its receipts in a pop-up, and a dashboard or Collections card
 * opens it already filtered. A receipt opens when tapped.
 */
export default function CashierHistoryScreen() {
    const insets = useSafeAreaInsets();
    const { request } = useAuth();
    const params = useLocalSearchParams<{ period?: string; date_from?: string; date_to?: string; method?: string; status?: string }>();
    const [first] = useState<PaymentFilters>(() => filtersFromLink(START, params));
    const [filters, setFilters] = useState<PaymentFilters>(first);
    const [search, setSearch] = useState('');
    const [rows, setRows] = useState<PaymentRow[] | null>(null);
    const [totals, setTotals] = useState<PaymentTotals | null>(null);
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const latest = useRef(0);

    const load = useCallback(
        async (next: PaymentFilters, pageNumber: number): Promise<void> => {
            const requestNumber = ++latest.current;
            setLoading(true);
            setError(null);

            try {
                const answer = await request<HistoryPage>(`/cashier/payments?${paymentQuery(next, pageNumber)}`);

                if (requestNumber === latest.current) {
                    setFilters(answer.filters);
                    setTotals(answer.totals);
                    setRows((current) => (pageNumber === 1 ? answer.payments.data : [...(current ?? []), ...answer.payments.data]));
                    setPage(answer.payments.current_page);
                    setLastPage(answer.payments.last_page);
                }
            } catch (caught) {
                if (requestNumber === latest.current) {
                    setError(loadErrorMessage(caught, 'The payments could not be loaded.'));
                }
            } finally {
                if (requestNumber === latest.current) {
                    setLoading(false);
                }
            }
        },
        [request],
    );

    useEffect(() => {
        void load(first, 1);
    }, [load, first]);

    // Search as the cashier types, after a short pause.
    useEffect(() => {
        if (search.trim() === filters.search) {
            return;
        }

        const timer = setTimeout(() => void load({ ...filters, search: search.trim() }, 1), 400);

        return () => clearTimeout(timer);
        // Only the typed search starts a new search.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const show = (next: Partial<PaymentFilters>): void => void load({ ...filters, ...next, search: search.trim() }, 1);

    const [sheet, setSheet] = useState<PaymentListRequest | null>(null);

    /**
     * A total opens its receipts in a pop-up: those of this list (same
     * period, type and search) that it counts. The pop-up's button shows
     * only them in the list, or all again when the total is the chosen one.
     * A total the list's own filter rules out (GCash while the list shows
     * Cash only) counts nothing, so it does not open.
     */
    const totalFilter = (
        method: PaymentFilters['method'],
        status: PaymentFilters['status'],
        title: string,
        icon: ReactNode,
        empty: string,
        extra: Partial<PaymentListRequest> = {},
    ): { active: boolean; onPress?: () => void } => {
        const active = filters.method === method && filters.status === status;
        const ruledOut = (method !== '' && filters.method !== '' && filters.method !== method) || (filters.status !== '' && filters.status !== status);

        if (ruledOut) {
            return { active };
        }

        const card = { method: method || filters.method, status };

        return {
            active,
            onPress: () =>
                setSheet({
                    title,
                    icon,
                    query: paymentQuery({ ...filters, ...card, search: search.trim() }),
                    empty,
                    action: {
                        label: active ? 'Show all receipts in the list' : 'Show only these in the list',
                        onPress: () => show(active ? { method: '', status: '' } : card),
                    },
                    ...extra,
                }),
        };
    };
    const voidTotal = totalFilter('', 'void', 'Voided Payments', <XCircle size={20} color="#b91c1c" />, 'No voided payments match this list.', { voided: true });

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
                <Text className="font-sans-bold text-2xl text-slate-900">Payment History</Text>
                <Text className="mt-1 font-sans text-sm text-slate-500">Every Payment Receipt issued. Tap one to open it.</Text>
            </View>

            <PaymentPeriodPicker filters={filters} onChange={show} />

            <View className="flex-row items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
                <Search size={17} color="#94a3b8" />
                <TextInput
                    value={search}
                    onChangeText={setSearch}
                    maxLength={100}
                    placeholder="Receipt, slip, buyer name or ID, GCash ref."
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="none"
                    className="h-11 flex-1 font-sans-medium text-sm text-slate-900"
                />
            </View>

            <ChipRow
                options={[
                    ['', 'All methods'],
                    ['cash', 'Cash'],
                    ['gcash', 'GCash'],
                ]}
                value={filters.method}
                onPick={(value) => show({ method: value as PaymentFilters['method'] })}
            />
            <ChipRow
                options={[
                    ['', 'Orders and preorders'],
                    ['order', 'Orders'],
                    ['preorder', 'Preorders'],
                ]}
                value={filters.type}
                onPick={(value) => show({ type: value as PaymentFilters['type'] })}
            />
            <ChipRow
                options={[
                    ['', 'Paid and voided'],
                    ['paid', 'Paid'],
                    ['void', 'Voided'],
                ]}
                value={filters.status}
                onPick={(value) => show({ status: value as PaymentFilters['status'] })}
            />

            {totals && (
                <View className="flex-row gap-2">
                    <Total label="Total" value={formatPeso(totals.total_centavos)} detail={receiptCount(totals.count)} {...totalFilter('', 'paid', 'Total Collected', <ReceiptText size={20} color="#1d4ed8" />, 'No payments match this list.', { split: true })} />
                    <Total label="Cash" value={formatPeso(totals.cash_centavos)} detail={receiptCount(totals.cash_count)} {...totalFilter('cash', 'paid', 'Cash Payments', <Banknote size={20} color="#1d4ed8" />, 'No cash payments match this list.')} />
                    <Total label="GCash" value={formatPeso(totals.gcash_centavos)} detail={receiptCount(totals.gcash_count)} {...totalFilter('gcash', 'paid', 'GCash Payments', <Smartphone size={20} color="#1d4ed8" />, 'No GCash payments match this list.')} />
                </View>
            )}
            {totals && totals.void_count > 0 && (
                <Pressable
                    onPress={voidTotal.onPress}
                    disabled={voidTotal.onPress === undefined}
                    accessibilityRole="button"
                    accessibilityState={{ selected: voidTotal.active }}
                    className={`flex-row items-center justify-between gap-2 rounded-2xl border px-3 py-2.5 ${voidTotal.active ? 'border-red-400 bg-red-100' : 'border-red-200 bg-red-50'}`}
                >
                    <Text className="flex-1 font-sans-semibold text-xs text-red-700">
                        {totals.void_count} {totals.void_count === 1 ? 'voided payment' : 'voided payments'} ({formatPeso(totals.void_centavos)}), not counted in the total.
                    </Text>
                    <Text className="font-sans-bold text-xs text-red-700">View</Text>
                </Pressable>
            )}

            {error ? (
                <LoadError message={error} onRetry={() => load(filters, 1)} className="" />
            ) : rows === null ? (
                <ActivityIndicator color="#0D6EFD" />
            ) : rows.length === 0 ? (
                <Text className="rounded-3xl border border-slate-200 bg-white px-4 py-8 text-center font-sans text-sm text-slate-500">
                    {filters.search !== ''
                        ? `No payment in this period matches "${filters.search}".`
                        : filters.method !== '' || filters.type !== '' || filters.status !== ''
                          ? 'No payments in this period match the chosen filters.'
                          : 'No payments were recorded in this period.'}
                </Text>
            ) : (
                <View className={`overflow-hidden rounded-3xl border border-slate-200 bg-white ${loading ? 'opacity-60' : ''}`}>
                    {rows.map((row, index) => (
                        <PaymentRowItem key={row.id} row={row} first={index === 0} />
                    ))}
                </View>
            )}

            {rows !== null && page < lastPage && (
                <Pressable
                    onPress={() => void load(filters, page + 1)}
                    disabled={loading}
                    accessibilityRole="button"
                    className="items-center rounded-2xl border border-slate-200 bg-white py-3"
                >
                    <Text className="font-sans-bold text-sm text-blue-700">{loading ? 'Loading…' : 'Show more'}</Text>
                </Pressable>
            )}
            <PaymentListSheet request={sheet} onClose={() => setSheet(null)} />
        </ScrollView>
    );
}

function ChipRow({ options, value, onPick }: { options: [string, string][]; value: string; onPick: (value: string) => void }) {
    return (
        <View className="flex-row flex-wrap gap-2">
            {options.map(([option, label]) => (
                <Pressable
                    key={option || 'all'}
                    onPress={() => onPick(option)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: value === option }}
                    className={`rounded-xl border px-3 py-1.5 ${value === option ? 'border-slate-900 bg-slate-900' : 'border-slate-200 bg-white'}`}
                >
                    <Text className={`font-sans-bold text-xs ${value === option ? 'text-white' : 'text-slate-600'}`}>{label}</Text>
                </Pressable>
            ))}
        </View>
    );
}

function Total({ label, value, detail, active, onPress }: { label: string; value: string; detail?: string; active: boolean; onPress?: () => void }) {
    return (
        <Pressable
            onPress={onPress}
            disabled={onPress === undefined}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className={`flex-1 rounded-2xl border p-3 ${active ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}
        >
            <Text className="font-sans-bold text-[11px] text-slate-500">{label}</Text>
            <Text className="font-sans-bold text-sm text-slate-900">{value}</Text>
            {detail ? <Text className="font-sans text-[11px] text-slate-500">{detail}</Text> : null}
            {onPress ? <Text className="mt-1 font-sans-bold text-[11px] text-blue-700">View</Text> : null}
        </Pressable>
    );
}
