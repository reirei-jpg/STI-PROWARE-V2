import { router, useFocusEffect } from 'expo-router';
import { PackagePlus, Search, Truck, Unlink, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    RefreshControl,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LoadError from '@/components/LoadError';
import LoadingState from '@/components/LoadingState';
import NoResults from '@/components/NoResults';
import { formatDate, formatDateTime, formatUnits } from '@/lib/format';
import type { RecordedDelivery } from '@/lib/types';
import { usePagedList } from '@/lib/use-paged-list';

/**
 * Deliveries from Head Office on the Specialist's phone: Record Delivery at
 * the counter as boxes arrive, and the deliveries already recorded (newest
 * first, searchable by Order #), like the website.
 */
export default function StaffDeliveriesScreen() {
    const insets = useSafeAreaInsets();
    const [searchText, setSearchText] = useState('');
    const [search, setSearch] = useState('');
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setSearch(searchText.trim()), 400);

        return () => clearTimeout(timer);
    }, [searchText]);

    const query = new URLSearchParams();

    if (search !== '') {
        query.set('search', search);
    }

    const deliveries = usePagedList<RecordedDelivery>(`/specialist/deliveries?${query.toString()}`);
    const { reload } = deliveries;

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
                <Text className="font-sans-bold text-2xl text-slate-900">Stock In</Text>
                <Text className="mt-1 font-sans text-sm text-slate-500">
                    Record what arrived from Head Office, right at the counter.
                </Text>
            </View>

            <Pressable
                onPress={() => router.push('/record-delivery')}
                accessibilityRole="button"
                className="flex-row items-center justify-center gap-2 rounded-2xl bg-brand py-4"
            >
                <PackagePlus size={20} color="#ffffff" />
                <Text className="font-sans-bold text-base text-white">Stock In</Text>
            </Pressable>

            <View className="flex-row items-center gap-2 rounded-full border border-slate-200 bg-white px-4">
                <Search size={17} color="#94a3b8" />
                <TextInput
                    value={searchText}
                    onChangeText={setSearchText} maxLength={40}
                    placeholder="Search by Order #"
                    placeholderTextColor="#94a3b8"
                    autoCorrect={false}
                    returnKeyType="search"
                    className="flex-1 py-3 font-sans-medium text-sm text-slate-900"
                />
                {searchText !== '' && (
                    <Pressable onPress={() => setSearchText('')} accessibilityLabel="Clear search" hitSlop={10}>
                        <X size={17} color="#64748b" />
                    </Pressable>
                )}
            </View>

            <Text className="font-sans-bold text-base text-slate-900">Recorded deliveries</Text>

            {deliveries.error && (
                <LoadError message={deliveries.error} onRetry={deliveries.reload} className="" />
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
            data={deliveries.items ?? []}
            keyExtractor={(delivery) => String(delivery.id)}
            ListHeaderComponent={header}
            renderItem={({ item }) => <DeliveryRow delivery={item} />}
            onEndReached={deliveries.loadMore}
            onEndReachedThreshold={0.5}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} />}
            ListFooterComponent={
                deliveries.loadingMore ? <ActivityIndicator color="#0D6EFD" className="py-4" /> : null
            }
            ListEmptyComponent={
                deliveries.error || deliveries.items === null ? (
                    deliveries.error ? null : <LoadingState />
                ) : search !== '' ? (
                    <NoResults
                        icon={<Truck size={40} color="#cbd5e1" />}
                        title={`No delivery matches "${search}".`}
                        hint="Search by the eStore Order # (e.g. 30722)."
                        onClearSearch={() => setSearchText('')}
                    />
                ) : (
                    <NoResults
                        icon={<Truck size={40} color="#cbd5e1" />}
                        title="No deliveries recorded yet."
                        hint="Tap Stock In above when Head Office delivers."
                    />
                )
            }
            keyboardShouldPersistTaps="handled"
        />
    );
}

function DeliveryRow({ delivery }: { delivery: RecordedDelivery }) {
    const numbers = [
        delivery.sales_invoice_number ? `SI ${delivery.sales_invoice_number}` : null,
        delivery.delivery_receipt_number ? `DR ${delivery.delivery_receipt_number}` : null,
    ].filter(Boolean);

    return (
        <View
            style={{
                borderLeftWidth: 5,
                borderLeftColor: delivery.items_not_in_stock > 0 ? '#f59e0b' : '#10b981',
            }}
            className="gap-1 rounded-2xl border border-slate-200 bg-white px-4 py-3"
        >
            <Text className="font-sans-bold text-base text-slate-900">
                Received {formatDate(delivery.received_on)}
            </Text>
            {numbers.length > 0 && (
                <Text className="font-sans-semibold text-xs text-slate-500">{numbers.join(' · ')}</Text>
            )}
            {delivery.order_numbers.length > 0 && (
                <Text className="font-sans text-sm text-slate-700">
                    Order #{delivery.order_numbers.join(', #')}
                </Text>
            )}
            <Text className="font-sans-bold text-sm text-emerald-700">
                {formatUnits(delivery.pieces_added_to_stock, 'Piece')} added to stock
            </Text>
            {delivery.items_not_in_stock > 0 && (
                <View className="flex-row items-center gap-1.5">
                    <Unlink size={13} color="#b45309" />
                    <Text className="flex-1 font-sans-semibold text-xs text-amber-700">
                        {delivery.items_not_in_stock === 1
                            ? '1 item not linked to a product, so not in stock yet'
                            : `${delivery.items_not_in_stock} items not linked to a product, so not in stock yet`}
                    </Text>
                </View>
            )}
            <Text className="font-sans text-[11px] text-slate-400">
                Recorded by {delivery.recorded_by} · {formatDateTime(delivery.recorded_at)}
            </Text>
        </View>
    );
}
