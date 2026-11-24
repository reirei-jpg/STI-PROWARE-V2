import { router, useFocusEffect } from 'expo-router';
import { Bell, ChevronLeft, ChevronRight, LockKeyhole, LockOpen, TriangleAlert } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LoadError from '@/components/LoadError';
import LoadingState from '@/components/LoadingState';
import { ApiError, loadErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatDateTime, formatPeso } from '@/lib/format';
import { useNotifications } from '@/lib/notifications';
import { DELIVERY_TABS } from '@/components/PurchaseOrderSheet';
import type { AdminOverview, LockedAccount, Page } from '@/lib/types';

type Period = AdminOverview['sales']['period'];

/** The website's period buttons, and the words used in the Sales notes. */
const PERIODS: { value: Period; label: string; words: string }[] = [
    { value: 'all', label: 'All time', words: 'so far' },
    { value: 'week', label: 'This week', words: 'this week' },
    { value: 'month', label: 'This month', words: 'this month' },
    { value: 'year', label: 'This year', words: 'this year' },
];

const tileTone: Record<string, { box: string; count: string }> = {
    amber: { box: 'border-amber-200 bg-amber-50', count: 'text-amber-800' },
    blue: { box: 'border-blue-200 bg-blue-50', count: 'text-blue-800' },
    green: { box: 'border-emerald-200 bg-emerald-50', count: 'text-emerald-800' },
};

/**
 * The School Admin's Dashboard on the phone, like the website's: a greeting
 * with today's date, any staff account locked after 5 wrong passwords (with
 * Unlock), the eStore orders by what has arrived (a tile opens them in eStore
 * Orders), the Stock box (products to reorder; it opens the stock lookup),
 * and the Sales box: four numbers, then the Best Sellers and the products
 * Not Selling, 5 at a time.
 */
export default function AdminHomeScreen() {
    const insets = useSafeAreaInsets();
    const { user, request } = useAuth();
    const { unreadCount, refresh: refreshNotifications } = useNotifications();
    const [overview, setOverview] = useState<AdminOverview | null>(null);
    // Products with a size at its Reorder Point or out of stock (the stock lookup's "To reorder").
    const [toReorder, setToReorder] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingSales, setLoadingSales] = useState(false);
    const [period, setPeriod] = useState<Period>('all');
    const [list, setList] = useState<'top' | 'slow'>('top');
    const pages = useRef({ top: 1, slow: 1 });
    const latest = useRef(0);

    const load = useCallback(
        async (nextPeriod: Period): Promise<void> => {
            const call = ++latest.current;
            const query = new URLSearchParams({
                period: nextPeriod,
                top_page: String(pages.current.top),
                slow_page: String(pages.current.slow),
            });

            try {
                const [answer, reorder] = await Promise.all([
                    request<AdminOverview>(`/admin/overview?${query.toString()}`),
                    request<{ total: number }>('/specialist/stock?low=1'),
                ]);

                if (call === latest.current) {
                    setOverview(answer);
                    setToReorder(reorder.total);
                    setError(null);
                }
            } catch (caught) {
                if (call === latest.current) {
                    setError(loadErrorMessage(caught, 'The dashboard could not be loaded.'));
                }
            } finally {
                if (call === latest.current) {
                    setLoadingSales(false);
                }
            }
        },
        [request],
    );

    useFocusEffect(
        useCallback(() => {
            void load(period);
            refreshNotifications().catch(() => undefined);
            // The period is loaded when it is chosen; coming back keeps it.
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [load, refreshNotifications]),
    );

    const pullToRefresh = async (): Promise<void> => {
        setRefreshing(true);
        await load(period);
        setRefreshing(false);
    };

    const choosePeriod = (next: Period): void => {
        if (next === period) {
            return;
        }

        pages.current = { top: 1, slow: 1 };
        setPeriod(next);
        setLoadingSales(true);
        void load(next);
    };

    const turnPage = (which: 'top' | 'slow', page: number): void => {
        pages.current = { ...pages.current, [which]: page };
        setLoadingSales(true);
        void load(period);
    };

    const askUnlock = (account: LockedAccount): void => {
        Alert.alert(`Unlock ${account.name}'s account?`, `Check that you are talking to ${account.name} first. They can sign in right away.`, [
            { text: 'Keep locked', style: 'cancel' },
            {
                text: 'Unlock',
                onPress: async () => {
                    try {
                        const result = await request<{ unlocked: boolean; message: string }>(`/admin/locked-accounts/${account.id}/unlock`, {
                            method: 'POST',
                        });

                        Alert.alert(result.unlocked ? 'Account unlocked' : 'Not locked', result.message);
                    } catch (caught) {
                        Alert.alert('Not unlocked', caught instanceof ApiError ? caught.message : 'The account could not be unlocked. Try again.');
                    } finally {
                        void load(period);
                    }
                },
            },
        ]);
    };

    const today = new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date());
    const locked = overview?.locked_accounts ?? [];
    const deliveries = overview?.deliveries;
    const sales = overview?.sales;
    const periodWords = PERIODS.find((option) => option.value === period)?.words ?? '';

    return (
        <ScrollView
            className="flex-1 bg-page"
            contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32, paddingHorizontal: 16, gap: 16 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} />}
        >
            <View className="rounded-3xl bg-brand px-5 py-5">
                <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                        <Text className="font-sans-semibold text-xs uppercase tracking-wide text-blue-100">STI PROWARE · School Admin</Text>
                        <Text className="mt-1 font-sans-bold text-2xl text-white">Welcome, {user?.name.split(' ')[0]}</Text>
                        <Text className="mt-0.5 font-sans text-sm leading-5 text-blue-50">{today} · eStore orders, deliveries and sales. View only.</Text>
                    </View>
                    <Pressable
                        onPress={() => router.push('/notifications')}
                        accessibilityRole="button"
                        accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
                        className="h-11 w-11 items-center justify-center rounded-2xl bg-white/15"
                    >
                        <Bell size={22} color="#ffffff" />
                        {unreadCount > 0 && (
                            <View className="absolute -right-1 -top-1 min-w-5 items-center rounded-full border-2 border-brand bg-red-500 px-1">
                                <Text className="font-sans-bold text-[10px] text-white">{unreadCount > 99 ? '99+' : unreadCount}</Text>
                            </View>
                        )}
                    </Pressable>
                </View>
            </View>

            {error && <LoadError message={error} onRetry={() => load(period)} className="" />}

            {overview === null ? (
                !error && <LoadingState />
            ) : (
                <>
                    {locked.length > 0 && (
                        <View className="gap-3 rounded-3xl border border-red-200 bg-red-50 p-4">
                            <View className="flex-row items-center gap-2">
                                <LockKeyhole size={18} color="#991b1b" />
                                <Text className="font-sans-bold text-base text-red-800">
                                    {locked.length === 1 ? `${locked[0].role_label} account locked` : 'Staff accounts locked'}
                                </Text>
                            </View>
                            <Text className="font-sans text-sm leading-5 text-red-900">
                                5 wrong passwords were typed in a row. A locked account opens by itself after 15 minutes, or you can unlock it now when its owner asks you.
                            </Text>
                            {locked.map((account) => (
                                <View key={account.id} className="gap-2 rounded-2xl border border-red-200 bg-white p-3.5">
                                    <View>
                                        <Text className="font-sans-bold text-sm text-slate-900">{account.name}</Text>
                                        <Text className="font-sans text-xs text-slate-500">
                                            {account.email} · {account.role_label}
                                        </Text>
                                        <Text className="mt-1 font-sans-bold text-xs text-red-700">Locked until {formatDateTime(account.locked_until)}</Text>
                                        {account.locks_today >= 3 && (
                                            <View className="mt-1 flex-row items-center gap-1">
                                                <TriangleAlert size={13} color="#b91c1c" />
                                                <Text className="flex-1 font-sans-bold text-xs text-red-700">
                                                    Locked {account.locks_today} times today: someone may be guessing the password.
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                    <Pressable
                                        onPress={() => askUnlock(account)}
                                        accessibilityRole="button"
                                        className="flex-row items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 py-2.5"
                                    >
                                        <LockOpen size={16} color="#047857" />
                                        <Text className="font-sans-bold text-sm text-emerald-700">Unlock</Text>
                                    </Pressable>
                                </View>
                            ))}
                        </View>
                    )}

                    {deliveries && (
                        <View className="gap-2.5">
                            <View className="flex-row items-baseline justify-between gap-2 px-1">
                                <Text className="font-sans-bold text-xs uppercase tracking-wide text-slate-700">eStore Orders</Text>
                                <Text className="font-sans text-xs text-slate-400">Tap one to see its orders.</Text>
                            </View>
                            {DELIVERY_TABS.map((option) => {
                                const late = option.value === 'completed' ? 0 : deliveries.counts[`${option.value}_late` as 'coming_late' | 'ongoing_late'];

                                return (
                                    <Pressable
                                        key={option.value}
                                        onPress={() => router.navigate({ pathname: '/admin-orders', params: { tab: option.value } })}
                                        accessibilityRole="button"
                                        accessibilityLabel={`${option.label}, ${deliveries.counts[option.value]}`}
                                        className={`flex-row items-center gap-3 rounded-3xl border p-4 ${tileTone[option.tone].box}`}
                                    >
                                        <View className="flex-1">
                                            <Text className="font-sans-bold text-[11px] uppercase tracking-wide text-slate-600">{option.label}</Text>
                                            <Text className={`font-sans-bold text-2xl ${tileTone[option.tone].count}`}>
                                                {deliveries.counts[option.value].toLocaleString('en-PH')}
                                            </Text>
                                            <Text className="font-sans text-xs text-slate-600">
                                                {option.hint}
                                                {late > 0 ? <Text className="font-sans-bold text-red-700">{` · ${late} late (not complete after ${deliveries.late_days} days)`}</Text> : null}
                                            </Text>
                                        </View>
                                        <ChevronRight size={18} color="#64748b" />
                                    </Pressable>
                                );
                            })}
                        </View>
                    )}

                    {toReorder !== null && (
                        <View className="gap-2.5">
                            <View className="flex-row items-baseline justify-between gap-2 px-1">
                                <Text className="font-sans-bold text-xs uppercase tracking-wide text-slate-700">Stock</Text>
                                <Text className="font-sans text-xs text-slate-400">Tap to see each size.</Text>
                            </View>
                            <Pressable
                                onPress={() => router.navigate({ pathname: '/admin-stock', params: { low: toReorder > 0 ? '1' : '0' } })}
                                accessibilityRole="button"
                                accessibilityLabel={`Reorder now, ${toReorder}`}
                                className={`flex-row items-center gap-3 rounded-3xl border p-4 ${toReorder > 0 ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}
                            >
                                <View className="flex-1">
                                    <Text className="font-sans-bold text-[11px] uppercase tracking-wide text-slate-600">Reorder now</Text>
                                    <Text className={`font-sans-bold text-2xl ${toReorder > 0 ? 'text-amber-800' : 'text-emerald-800'}`}>
                                        {toReorder.toLocaleString('en-PH')}
                                    </Text>
                                    <Text className="font-sans text-xs text-slate-600">
                                        {toReorder === 0
                                            ? 'Every size is above its Reorder Point.'
                                            : `${toReorder === 1 ? 'product has' : 'products have'} a size at its Reorder Point or out of stock, with a suggested order.`}
                                    </Text>
                                </View>
                                <ChevronRight size={18} color="#64748b" />
                            </Pressable>
                        </View>
                    )}

                    {sales && (
                        <View className="gap-3 rounded-3xl border border-slate-200 bg-white p-4">
                            <View>
                                <Text className="font-sans-bold text-lg text-slate-900">Sales</Text>
                                <Text className="mt-0.5 font-sans text-xs leading-5 text-slate-500">
                                    What students and STI staff bought (counted once their items are released to them), and what is not selling ·{' '}
                                    {formatDate(sales.from)} to {formatDate(sales.to)}.
                                </Text>
                            </View>

                            <View className="flex-row flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                                {PERIODS.map((option) => (
                                    <Pressable
                                        key={option.value}
                                        onPress={() => choosePeriod(option.value)}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected: option.value === period }}
                                        className={`flex-1 items-center rounded-lg px-1 py-2 ${option.value === period ? 'bg-brand' : ''}`}
                                    >
                                        <Text className={`font-sans-bold text-xs ${option.value === period ? 'text-white' : 'text-slate-600'}`}>{option.label}</Text>
                                    </Pressable>
                                ))}
                            </View>

                            <View className={`gap-2.5 ${loadingSales ? 'opacity-50' : ''}`}>
                                <View className="flex-row gap-2.5">
                                    <SalesNumber label="Pieces Sold" value={sales.totals.pieces.toLocaleString('en-PH')} note={`Pieces released to buyers ${periodWords}`} />
                                    <SalesNumber label="Total Sales" value={formatPeso(sales.totals.price_centavos)} note="What buyers paid at the cashier for those pieces" />
                                </View>
                                <View className="flex-row gap-2.5">
                                    <SalesNumber
                                        label="Best Seller"
                                        value={sales.totals.best?.product_name ?? 'None yet'}
                                        note={
                                            sales.totals.best
                                                ? `${sales.totals.best.pieces.toLocaleString('en-PH')} ${sales.totals.best.pieces === 1 ? 'pc' : 'pcs'} sold${sales.totals.best.top_variant_label ? ` · most sold size/color: ${sales.totals.best.top_variant_label}` : ''}`
                                                : `Nothing was released to buyers ${periodWords}`
                                        }
                                        tone="green"
                                        small
                                    />
                                    <SalesNumber
                                        label="Not Selling"
                                        value={`${sales.not_selling.total} ${sales.not_selling.total === 1 ? 'product' : 'products'}`}
                                        note={`${sales.totals.not_selling_pieces.toLocaleString('en-PH')} pcs in stock with no sale in the last ${sales.slow_days} days`}
                                        tone="amber"
                                    />
                                </View>
                            </View>

                            <View className="flex-row border-b border-slate-200">
                                {(
                                    [
                                        { value: 'top', label: 'Best Sellers', count: sales.top_sellers.total, countClass: 'bg-blue-100 text-blue-800' },
                                        { value: 'slow', label: 'Not Selling', count: sales.not_selling.total, countClass: 'bg-amber-100 text-amber-800' },
                                    ] as const
                                ).map((option) => (
                                    <Pressable
                                        key={option.value}
                                        onPress={() => setList(option.value)}
                                        accessibilityRole="tab"
                                        accessibilityState={{ selected: list === option.value }}
                                        className={`-mb-px flex-row items-center gap-1.5 border-b-[3px] px-3 py-2.5 ${list === option.value ? 'border-brand' : 'border-transparent'}`}
                                    >
                                        <Text className={`font-sans-bold text-sm ${list === option.value ? 'text-brand' : 'text-slate-500'}`}>{option.label}</Text>
                                        <Text className={`rounded-full px-2 py-0.5 font-sans-bold text-xs ${option.countClass}`}>{option.count.toLocaleString('en-PH')}</Text>
                                    </Pressable>
                                ))}
                            </View>

                            {list === 'top' ? (
                                sales.top_sellers.data.length === 0 ? (
                                    <Text className="py-8 text-center font-sans text-sm text-slate-500">Nothing was released to buyers {periodWords}.</Text>
                                ) : (
                                    <View>
                                        {sales.top_sellers.data.map((row, index) => (
                                            <View key={row.product_id} className={`flex-row items-center gap-3 py-3 ${index > 0 ? 'border-t border-slate-100' : ''}`}>
                                                <View className={`h-9 w-9 items-center justify-center rounded-xl ${row.rank === 1 ? 'bg-amber-100' : 'bg-slate-100'}`}>
                                                    <Text className={`font-sans-bold text-sm ${row.rank === 1 ? 'text-amber-800' : 'text-slate-600'}`}>{row.rank}</Text>
                                                </View>
                                                <View className="flex-1">
                                                    <Text numberOfLines={1} className="font-sans-bold text-sm text-slate-900">
                                                        {row.product_name}
                                                    </Text>
                                                    <Text className="font-sans text-xs text-slate-500">
                                                        {formatPeso(row.price_total_centavos)} in sales
                                                        {row.top_variant_label
                                                            ? ` · most sold size/color: ${row.top_variant_label} (${row.top_variant_pieces} ${row.top_variant_pieces === 1 ? 'pc' : 'pcs'})`
                                                            : ''}
                                                    </Text>
                                                </View>
                                                <Text className="text-right">
                                                    <Text className="font-sans-bold text-lg text-emerald-700">{row.pieces.toLocaleString('en-PH')}</Text>
                                                    <Text className="font-sans-bold text-xs text-slate-500"> {row.pieces === 1 ? 'pc' : 'pcs'} sold</Text>
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                )
                            ) : (
                                <>
                                    <Text className="font-sans text-xs leading-5 text-slate-500">
                                        In stock, arrived at least {sales.slow_days} days ago, and nothing sold in the last {sales.slow_days} days (the Specialist&apos;s
                                        slow-moving items). The longest without a sale first.
                                    </Text>
                                    {sales.not_selling.data.length === 0 ? (
                                        <Text className="py-8 text-center font-sans-semibold text-sm text-emerald-700">
                                            Every product in stock sold something in the last {sales.slow_days} days.
                                        </Text>
                                    ) : (
                                        <View>
                                            {sales.not_selling.data.map((row, index) => (
                                                <View key={row.product_id} className={`flex-row items-center gap-3 py-3 ${index > 0 ? 'border-t border-slate-100' : ''}`}>
                                                    <View className="flex-1">
                                                        <Text numberOfLines={1} className="font-sans-bold text-sm text-slate-900">
                                                            {row.product_name}
                                                        </Text>
                                                        <Text className="font-sans text-xs text-slate-500">
                                                            {row.stock_pieces.toLocaleString('en-PH')} {row.stock_pieces === 1 ? 'pc' : 'pcs'} in stock ·{' '}
                                                            {row.last_sold_at ? `last sold ${formatDateTime(row.last_sold_at)}` : `arrived ${formatDateTime(row.first_arrived_at)}`}
                                                        </Text>
                                                    </View>
                                                    <Text className="rounded-full bg-amber-100 px-2.5 py-1 font-sans-bold text-xs text-amber-800">
                                                        {row.last_sold_at ? `No sale for ${row.days_without_sale} days` : 'Never sold'}
                                                    </Text>
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                </>
                            )}

                            <Pager
                                page={list === 'top' ? sales.top_sellers : sales.not_selling}
                                busy={loadingSales}
                                onPage={(page) => turnPage(list, page)}
                            />
                        </View>
                    )}
                </>
            )}
        </ScrollView>
    );
}

/** One of the four numbers at the top of the Sales box. */
function SalesNumber({
    label,
    value,
    note,
    tone = 'plain',
    small = false,
}: {
    label: string;
    value: string;
    note: string;
    tone?: 'plain' | 'green' | 'amber';
    small?: boolean;
}) {
    const box = tone === 'green' ? 'border-emerald-200 bg-emerald-50' : tone === 'amber' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white';

    return (
        <View className={`flex-1 rounded-2xl border px-3.5 py-3 ${box}`}>
            <Text className="font-sans-bold text-[11px] uppercase tracking-wide text-slate-500">{label}</Text>
            <Text numberOfLines={2} className={`mt-1 font-sans-bold text-slate-900 ${small ? 'text-base' : 'text-xl'}`}>
                {value}
            </Text>
            <Text className="mt-1 font-sans text-[11px] leading-4 text-slate-500">{note}</Text>
        </View>
    );
}

/** Previous / Next for a Sales list, 5 at a time, as on the website. */
function Pager({ page, busy, onPage }: { page: Page<unknown>; busy: boolean; onPage: (page: number) => void }) {
    if (page.last_page <= 1) {
        return null;
    }

    return (
        <View className="flex-row items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <PagerButton label="Previous" disabled={busy || page.current_page <= 1} onPress={() => onPage(page.current_page - 1)} back />
            {busy ? (
                <ActivityIndicator color="#0D6EFD" />
            ) : (
                <Text className="font-sans text-xs text-slate-500">
                    Page {page.current_page} of {page.last_page}
                </Text>
            )}
            <PagerButton label="Next" disabled={busy || page.current_page >= page.last_page} onPress={() => onPage(page.current_page + 1)} />
        </View>
    );
}

function PagerButton({ label, disabled, onPress, back = false }: { label: string; disabled: boolean; onPress: () => void; back?: boolean }) {
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`${label} products`}
            className={`flex-row items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 ${disabled ? 'opacity-40' : ''}`}
        >
            {back && <ChevronLeft size={15} color="#334155" />}
            <Text className="font-sans-bold text-sm text-slate-700">{label}</Text>
            {!back && <ChevronRight size={15} color="#334155" />}
        </Pressable>
    );
}
