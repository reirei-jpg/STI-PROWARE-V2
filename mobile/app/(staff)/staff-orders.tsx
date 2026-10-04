import { router, useFocusEffect } from 'expo-router';
import { ChevronRight, Package, Search, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import OrderStatusPill, { orderNote, orderStripeColors } from '@/components/OrderStatusPill';
import { formatPeso } from '@/lib/format';
import type { SpecialistOrder, SpecialistOrderCounts } from '@/lib/types';
import { usePagedList } from '@/lib/use-paged-list';

type Show = 'placed' | 'ready' | 'picked_up' | 'cancelled' | 'all';

const TABS: { value: Show; label: string }[] = [
    { value: 'placed', label: 'New' },
    { value: 'ready', label: 'Ready' },
    { value: 'picked_up', label: 'Picked up' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'all', label: 'All' },
];

/**
 * Students' orders on the Specialist's phone, like the website's Orders
 * page: New orders by default (nearest pick-up date first), Ready, Picked
 * up, Cancelled or All, with a search by order number or student. Tapping
 * an order opens it with Ready for pickup, Picked up and Cancel.
 */
export default function StaffOrdersScreen() {
    const insets = useSafeAreaInsets();
    const [show, setShow] = useState<Show>('placed');
    const [searchText, setSearchText] = useState('');
    const [search, setSearch] = useState('');
    const [refreshing, setRefreshing] = useState(false);

    // Search after a short pause in typing.
    useEffect(() => {
        const timer = setTimeout(() => setSearch(searchText.trim()), 400);

        return () => clearTimeout(timer);
    }, [searchText]);

    const query = new URLSearchParams({ show });

    if (search !== '') {
        query.set('search', search);
    }

    const orders = usePagedList<SpecialistOrder, { counts: SpecialistOrderCounts }>(
        `/specialist/orders?${query.toString()}`,
    );
    const { reload } = orders;
    const counts = orders.extra?.counts;

    // A new filter or search loads again, and so does coming back here.
    useFocusEffect(
        useCallback(() => {
            void reload();
        }, [reload]),
    );

    const pullToRefresh = async (): Promise<void> => {
        setRefreshing(true);
        await reload();
        setRefreshing(false);
    };

    const header = (
        <View className="gap-3 pb-2">
            <View>
                <Text className="font-sans-bold text-2xl text-slate-900">Orders</Text>
                <Text className="mt-1 font-sans text-sm text-slate-500">
                    Prepare, mark ready, and hand over when the student pays.
                </Text>
            </View>

            <View className="flex-row items-center gap-2 rounded-full border border-slate-200 bg-white px-4">
                <Search size={17} color="#94a3b8" />
                <TextInput
                    value={searchText}
                    onChangeText={setSearchText}
                    placeholder="Order number or student"
                    placeholderTextColor="#94a3b8"
                    autoCorrect={false}
                    returnKeyType="search"
                    className="flex-1 py-3 font-sans-medium text-sm text-slate-900"
                />
                {searchText !== '' && (
                    <Pressable
                        onPress={() => setSearchText('')}
                        accessibilityLabel="Clear search"
                        hitSlop={10}
                    >
                        <X size={17} color="#64748b" />
                    </Pressable>
                )}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {TABS.map((tab) => {
                    const chosen = show === tab.value;
                    const count = tab.value === 'all' ? null : counts?.[tab.value];

                    return (
                        <Pressable
                            key={tab.value}
                            onPress={() => setShow(tab.value)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: chosen }}
                            className={`flex-row items-center gap-1.5 rounded-full border px-4 py-2 ${chosen ? 'border-brand bg-brand' : 'border-slate-200 bg-white'}`}
                        >
                            <Text
                                numberOfLines={1}
                                className={`font-sans-bold text-xs ${chosen ? 'text-white' : 'text-slate-600'}`}
                            >
                                {tab.label}
                            </Text>
                            {count != null && count > 0 && (
                                <View
                                    className={`min-w-5 items-center rounded-full px-1.5 ${chosen ? 'bg-white/25' : 'bg-slate-100'}`}
                                >
                                    <Text
                                        className={`font-sans-bold text-[11px] ${chosen ? 'text-white' : 'text-slate-600'}`}
                                    >
                                        {count}
                                    </Text>
                                </View>
                            )}
                        </Pressable>
                    );
                })}
            </ScrollView>

            {orders.error && (
                <View className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                    <Text className="font-sans-semibold text-sm text-red-700">{orders.error}</Text>
                </View>
            )}
        </View>
    );

    return (
        <FlatList
            className="flex-1 bg-page"
            contentContainerStyle={{
                paddingTop: insets.top + 16,
                paddingBottom: 32,
                paddingHorizontal: 16,
                gap: 10,
            }}
            data={orders.items ?? []}
            keyExtractor={(order) => String(order.id)}
            ListHeaderComponent={header}
            renderItem={({ item }) => <OrderRow order={item} />}
            onEndReached={orders.loadMore}
            onEndReachedThreshold={0.5}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} />}
            ListFooterComponent={
                orders.loadingMore ? <ActivityIndicator color="#0D6EFD" className="py-4" /> : null
            }
            ListEmptyComponent={
                orders.items === null ? (
                    <ActivityIndicator color="#0D6EFD" className="mt-10" />
                ) : (
                    <View className="items-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12">
                        <Package size={40} color="#cbd5e1" />
                        <Text className="mt-3 text-center font-sans-bold text-base text-slate-700">
                            {search !== ''
                                ? 'No order matches your search.'
                                : show === 'placed'
                                  ? 'No new orders to prepare.'
                                  : 'No orders here.'}
                        </Text>
                    </View>
                )
            }
            keyboardShouldPersistTaps="handled"
        />
    );
}

function OrderRow({ order }: { order: SpecialistOrder }) {
    const isOpen = order.status === 'placed' || order.status === 'ready';
    const note = orderNote(order);
    const itemCount = order.items.length;

    return (
        <Pressable
            onPress={() => router.push(`/staff-order/${order.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Order ${order.number} for ${order.student_name}, ${order.status_label}`}
            style={{ borderLeftWidth: 5, borderLeftColor: orderStripeColors[order.status] }}
            className={`flex-row items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 ${isOpen ? '' : 'opacity-70'}`}
        >
            <View className="flex-1 gap-1">
                <View className="flex-row items-center justify-between gap-2">
                    <Text className="font-sans-bold text-base text-slate-900">{order.number}</Text>
                    <OrderStatusPill order={order} />
                </View>
                <Text numberOfLines={1} className="font-sans-semibold text-sm text-slate-800">
                    {order.student_name}
                </Text>
                <Text className="font-sans text-sm text-slate-600">
                    {itemCount} {itemCount === 1 ? 'item' : 'items'} ·{' '}
                    <Text className="font-sans-bold text-slate-900">
                        {formatPeso(order.total_centavos)}
                    </Text>
                </Text>
                <Text className={`text-xs ${note.className}`}>{note.text}</Text>
            </View>
            <ChevronRight size={18} color="#94a3b8" />
        </Pressable>
    );
}
