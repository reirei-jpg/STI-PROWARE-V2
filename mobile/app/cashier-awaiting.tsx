import { router } from 'expo-router';
import { ArrowLeft, Banknote, Search } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LoadError from '@/components/LoadError';
import StaffTag from '@/components/StaffTag';
import { loadErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatDateTime, formatPeso } from '@/lib/format';
import type { AwaitingRow, Page } from '@/lib/types';

type AwaitingAnswer = { orders: Page<AwaitingRow>; slips: Page<AwaitingRow> };

/**
 * Awaiting Payment on the phone, like the website's: orders and preorder
 * slips not paid yet, the oldest first, found by slip number, buyer name or
 * ID when the buyer has no slip. Record Payment opens the slip.
 */
export default function CashierAwaitingScreen() {
    const insets = useSafeAreaInsets();
    const { request } = useAuth();
    const [tab, setTab] = useState<'orders' | 'slips'>('orders');
    const [search, setSearch] = useState('');
    const [answer, setAnswer] = useState<AwaitingAnswer | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const latest = useRef(0);

    const load = useCallback(
        async (term: string): Promise<void> => {
            const requestNumber = ++latest.current;
            setLoading(true);
            setError(null);

            try {
                const result = await request<AwaitingAnswer>(`/cashier/awaiting?${new URLSearchParams(term === '' ? {} : { search: term }).toString()}`);

                if (requestNumber === latest.current) {
                    setAnswer(result);
                }
            } catch (caught) {
                if (requestNumber === latest.current) {
                    setError(loadErrorMessage(caught, 'The list could not be loaded.'));
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
        const timer = setTimeout(() => void load(search.trim()), search === '' ? 0 : 400);

        return () => clearTimeout(timer);
    }, [load, search]);

    const rows = answer === null ? null : tab === 'orders' ? answer.orders : answer.slips;

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
                <Text className="font-sans-bold text-2xl text-slate-900">Awaiting Payment</Text>
                <Text className="mt-1 font-sans text-sm text-slate-500">Not paid yet, the oldest first. Search when the buyer has no slip.</Text>
            </View>

            <View className="flex-row items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
                <Search size={17} color="#94a3b8" />
                <TextInput
                    value={search}
                    onChangeText={setSearch}
                    maxLength={100}
                    placeholder="Slip number, buyer name or ID"
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="none"
                    className="h-11 flex-1 font-sans-medium text-sm text-slate-900"
                />
            </View>

            <View className="flex-row gap-2">
                {(
                    [
                        ['orders', 'Orders', answer?.orders.total],
                        ['slips', 'Preorder slips', answer?.slips.total],
                    ] as const
                ).map(([value, label, count]) => (
                    <Pressable
                        key={value}
                        onPress={() => setTab(value)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: tab === value }}
                        className={`flex-1 items-center rounded-xl border py-2.5 ${tab === value ? 'border-brand bg-brand' : 'border-slate-200 bg-white'}`}
                    >
                        <Text className={`font-sans-bold text-sm ${tab === value ? 'text-white' : 'text-slate-600'}`}>
                            {label} ({count ?? 0})
                        </Text>
                    </Pressable>
                ))}
            </View>

            {error ? (
                <LoadError message={error} onRetry={() => load(search.trim())} className="" />
            ) : rows === null ? (
                <ActivityIndicator color="#0D6EFD" />
            ) : rows.data.length === 0 ? (
                <Text className="rounded-3xl border border-slate-200 bg-white px-4 py-8 text-center font-sans text-sm text-slate-500">
                    {search.trim() !== ''
                        ? `Nothing awaiting payment matches "${search.trim()}".`
                        : tab === 'orders'
                          ? 'No orders are awaiting payment.'
                          : 'No preorder slips are awaiting payment.'}
                </Text>
            ) : (
                <View className={`overflow-hidden rounded-3xl border border-slate-200 bg-white ${loading ? 'opacity-60' : ''}`}>
                    {rows.data.map((row, index) => (
                        <View key={`${row.kind}-${row.id}`} className={`gap-2 px-4 py-3 ${index > 0 ? 'border-t border-slate-100' : ''}`}>
                            <View className="flex-row items-start justify-between gap-2">
                                <View className="flex-1">
                                    <View className="flex-row flex-wrap items-center gap-1.5">
                                        <Text className="font-sans-bold text-sm text-slate-900">
                                            {row.number} · {row.buyer_name}
                                        </Text>
                                        {row.is_staff && <StaffTag />}
                                    </View>
                                    <Text className="font-sans text-xs text-slate-500" numberOfLines={2}>
                                        {row.for}
                                    </Text>
                                    <Text className="font-sans text-xs text-slate-400">
                                        {row.buyer_id ? `${row.buyer_id} · ` : ''}since {formatDateTime(row.since)}
                                    </Text>
                                    {row.pay_until ? (
                                        <Text className="font-sans-bold text-xs text-amber-700">Pay by {formatDate(row.pay_until)}</Text>
                                    ) : null}
                                </View>
                                <Text className="font-sans-bold text-sm text-slate-900">{formatPeso(row.amount_centavos)}</Text>
                            </View>
                            <Pressable
                                onPress={() => router.push({ pathname: '/cashier-slip', params: { code: row.number ?? '' } })}
                                accessibilityRole="button"
                                className="flex-row items-center justify-center gap-1.5 rounded-lg bg-brand py-2"
                            >
                                <Banknote size={15} color="#ffffff" />
                                <Text className="font-sans-bold text-sm text-white">Record Payment</Text>
                            </Pressable>
                        </View>
                    ))}
                    {rows.last_page > 1 && (
                        <Text className="border-t border-slate-100 px-4 py-2 text-center font-sans text-xs text-slate-500">
                            Showing the {rows.data.length} oldest of {rows.total}. Search to find a buyer.
                        </Text>
                    )}
                </View>
            )}
        </ScrollView>
    );
}
