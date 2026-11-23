import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ChevronRight, CircleAlert, ClipboardList, Search, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LoadError from '@/components/LoadError';
import NoResults from '@/components/NoResults';
import PurchaseOrderSheet, { DELIVERY_TABS, statusTone } from '@/components/PurchaseOrderSheet';
import { loadErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatDateTime } from '@/lib/format';
import type { AdminDeliveryTab, AdminOrderRow, AdminOverview } from '@/lib/types';

const chipTone: Record<string, { on: string; count: string }> = {
    amber: { on: 'border-amber-400 bg-amber-50', count: 'bg-amber-100 text-amber-800' },
    blue: { on: 'border-brand bg-blue-50', count: 'bg-blue-100 text-blue-800' },
    green: { on: 'border-emerald-500 bg-emerald-50', count: 'bg-emerald-100 text-emerald-800' },
};

const emptyText: Record<AdminDeliveryTab, string> = {
    coming: 'No order is awaiting delivery. An order shows here as soon as the Specialist uploads it, until its first items arrive.',
    ongoing: 'No order is partially received right now. An order shows here once its first items arrive, until the rest arrive.',
    completed: 'No order is completed yet. An order shows here once everything arrived, or when the Specialist closes it with some items missing.',
};

/**
 * The eStore orders the Specialist uploaded, on the School Admin's phone,
 * by what has arrived (the website's dashboard box): a search by Order #,
 * 5 at a time with Show more, and each order's details with Remind
 * Specialist when it is late. A notice about an order opens it here.
 */
export default function AdminOrdersScreen() {
    const insets = useSafeAreaInsets();
    const { request } = useAuth();
    const params = useLocalSearchParams<{ tab?: string; view?: string }>();
    const [tab, setTab] = useState<AdminDeliveryTab>(DELIVERY_TABS.some((option) => option.value === params.tab) ? (params.tab as AdminDeliveryTab) : 'ongoing');
    const [searchText, setSearchText] = useState('');
    const [search, setSearch] = useState('');
    const [answer, setAnswer] = useState<AdminOverview['deliveries'] | null>(null);
    const [rows, setRows] = useState<AdminOrderRow[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [viewing, setViewing] = useState<number | null>(null);
    const latest = useRef(0);

    // A tab or a notice chosen from elsewhere (the Dashboard, Notifications).
    useEffect(() => {
        if (DELIVERY_TABS.some((option) => option.value === params.tab)) {
            setTab(params.tab as AdminDeliveryTab);
        }

        const view = Number(params.view);

        if (Number.isInteger(view) && view > 0) {
            setViewing(view);
        }
    }, [params.tab, params.view]);

    useEffect(() => {
        const timer = setTimeout(() => setSearch(searchText.trim().replace(/^#/, '')), 400);

        return () => clearTimeout(timer);
    }, [searchText]);

    const load = useCallback(
        async (page = 1): Promise<void> => {
            const call = ++latest.current;
            setError(null);

            if (page > 1) {
                setLoadingMore(true);
            }

            try {
                const query = new URLSearchParams({ tab, page: String(page) });

                if (search !== '') {
                    query.set('search', search);
                }

                const result = await request<AdminOverview>(`/admin/overview?${query.toString()}`);

                if (call === latest.current) {
                    setAnswer(result.deliveries);
                    setRows((current) => (page === 1 ? result.deliveries.orders.data : [...current, ...result.deliveries.orders.data]));
                }
            } catch (caught) {
                if (call === latest.current) {
                    setError(loadErrorMessage(caught, 'The eStore orders could not be loaded.'));
                }
            } finally {
                setLoadingMore(false);
            }
        },
        [request, search, tab],
    );

    useFocusEffect(
        useCallback(() => {
            void load(1);
        }, [load]),
    );

    const pullToRefresh = async (): Promise<void> => {
        setRefreshing(true);
        await load(1);
        setRefreshing(false);
    };

    const counts = answer?.counts;
    const orders = answer?.orders;
    const current = DELIVERY_TABS.find((option) => option.value === tab);
    const otherTabs = counts ? DELIVERY_TABS.filter((option) => option.value !== tab && counts[option.value] > 0) : [];

    return (
        <ScrollView
            className="flex-1 bg-page"
            contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32, paddingHorizontal: 16, gap: 14 }}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} />}
        >
            <View>
                <Text className="font-sans-bold text-2xl text-slate-900">eStore Orders</Text>
                <Text className="mt-1 font-sans text-sm text-slate-500">
                    Every eStore order the Specialist uploaded, by how much has arrived. Tap one to see its items and Delivery History. View only.
                </Text>
            </View>

            <View className="gap-2">
                {DELIVERY_TABS.map((option) => {
                    const selected = option.value === tab;
                    const late = option.value === 'completed' || !counts ? 0 : counts[`${option.value}_late` as 'coming_late' | 'ongoing_late'];

                    return (
                        <Pressable
                            key={option.value}
                            onPress={() => setTab(option.value)}
                            accessibilityRole="tab"
                            accessibilityState={{ selected }}
                            className={`rounded-2xl border-2 px-4 py-3 ${selected ? chipTone[option.tone].on : 'border-slate-200 bg-white'}`}
                        >
                            <View className="flex-row items-center justify-between gap-2">
                                <Text className="font-sans-bold text-base text-slate-900">{option.label}</Text>
                                <Text className={`min-w-7 rounded-full px-2 py-0.5 text-center font-sans-bold text-sm ${chipTone[option.tone].count}`}>
                                    {counts ? counts[option.value].toLocaleString('en-PH') : '—'}
                                </Text>
                            </View>
                            <Text className="mt-0.5 font-sans text-xs text-slate-600">
                                {option.hint}
                                {late > 0 ? <Text className="font-sans-bold text-red-700">{` · ${late} late (not complete after ${answer?.late_days} days)`}</Text> : null}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>

            <View className="flex-row items-center gap-2 rounded-full border border-slate-200 bg-white px-4">
                <Search size={17} color="#94a3b8" />
                <TextInput
                    value={searchText}
                    onChangeText={setSearchText}
                    maxLength={40}
                    placeholder="Search by Order #"
                    placeholderTextColor="#94a3b8"
                    keyboardType="number-pad"
                    autoCorrect={false}
                    className="flex-1 py-3 font-sans-medium text-sm text-slate-900"
                />
                {searchText !== '' && (
                    <Pressable onPress={() => setSearchText('')} accessibilityLabel="Clear search" hitSlop={10}>
                        <X size={17} color="#64748b" />
                    </Pressable>
                )}
            </View>

            {error ? (
                <LoadError message={error} onRetry={() => load(1)} className="" />
            ) : answer === null ? (
                <ActivityIndicator color="#0D6EFD" className="py-8" />
            ) : rows.length === 0 ? (
                search !== '' ? (
                    <NoResults
                        icon={<ClipboardList size={40} color="#cbd5e1" />}
                        title={`No ${current?.label} order matches #${search}.`}
                        hint={otherTabs.length > 0 ? `It is in ${otherTabs.map((option) => option.label).join(' and ')}.` : 'Check the Order #, or clear the search.'}
                        onClearSearch={() => setSearchText('')}
                    />
                ) : (
                    <Text className="rounded-3xl border border-slate-200 bg-white px-4 py-8 text-center font-sans text-sm text-slate-500">{emptyText[tab]}</Text>
                )
            ) : (
                <View className="gap-2.5">
                    {rows.map((row) => (
                        <OrderRow key={row.id} row={row} lateDays={answer.late_days} onPress={() => setViewing(row.id)} />
                    ))}
                </View>
            )}

            {orders && orders.current_page < orders.last_page && (
                <Pressable
                    onPress={() => void load(orders.current_page + 1)}
                    disabled={loadingMore}
                    accessibilityRole="button"
                    className="items-center rounded-2xl border border-slate-200 bg-white py-3"
                >
                    <Text className="font-sans-bold text-sm text-blue-700">
                        {loadingMore ? 'Loading…' : `Show more (${rows.length} of ${orders.total})`}
                    </Text>
                </Pressable>
            )}

            <PurchaseOrderSheet
                purchaseOrderId={viewing}
                onClose={() => {
                    setViewing(null);
                    router.setParams({ view: undefined });
                }}
                onChanged={() => void load(1)}
            />
        </ScrollView>
    );
}

function OrderRow({ row, lateDays, onPress }: { row: AdminOrderRow; lateDays: number; onPress: () => void }) {
    const tone = statusTone[row.status];

    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            style={{ borderLeftWidth: 5, borderLeftColor: row.is_late ? '#ef4444' : tone.bar }}
            className="gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 py-3"
        >
            <View className="flex-row items-center justify-between gap-2">
                <Text className="font-sans-bold text-base text-blue-700">{row.order_number ? `#${row.order_number}` : 'No Order #'}</Text>
                <ChevronRight size={18} color="#94a3b8" />
            </View>
            <Text className="font-sans text-xs text-slate-500">
                Ordered {formatDate(row.date_ordered)}
                {row.category ? ` · ${row.category}` : ''} · {row.items_count} {row.items_count === 1 ? 'item' : 'items'}
            </Text>
            <View className="h-2 overflow-hidden rounded-full bg-slate-200">
                <View style={{ width: `${row.percent_received}%`, backgroundColor: tone.bar }} className="h-full rounded-full" />
            </View>
            <Text className="font-sans text-xs text-slate-600">
                {row.percent_received}% · {row.quantity_received.toLocaleString('en-PH')} of {row.quantity_ordered.toLocaleString('en-PH')} pcs received
            </Text>
            <View className="flex-row flex-wrap items-center gap-2">
                <Text className={`rounded-full px-2.5 py-0.5 font-sans-bold text-xs ${tone.box} ${tone.text}`}>{row.status_label}</Text>
                {row.is_late && (
                    <View className="flex-row items-center gap-1">
                        <CircleAlert size={13} color="#b91c1c" />
                        <Text className="font-sans-bold text-xs text-red-700">Late: not complete after {lateDays} days</Text>
                    </View>
                )}
            </View>
            {row.completed_at && (
                <Text className="font-sans text-xs text-slate-500">Completed {formatDateTime(row.completed_at)}</Text>
            )}
            {row.reminded_at && (
                <Text className="font-sans text-[11px] text-slate-400">Specialist reminded {formatDateTime(row.reminded_at)}</Text>
            )}
        </Pressable>
    );
}
