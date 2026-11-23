import { useFocusEffect } from 'expo-router';
import { Search, Truck, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import DeliveryRow from '@/components/DeliveryRow';
import LoadError from '@/components/LoadError';
import LoadingState from '@/components/LoadingState';
import NoResults from '@/components/NoResults';
import type { RecordedDelivery } from '@/lib/types';
import { usePagedList } from '@/lib/use-paged-list';

/**
 * Stock In on the School Admin's phone (view only, like the website): the
 * deliveries from Head Office the Specialist recorded, newest first,
 * searchable by Order #.
 */
export default function AdminStockInScreen() {
    const insets = useSafeAreaInsets();
    const [searchText, setSearchText] = useState('');
    const [search, setSearch] = useState('');
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setSearch(searchText.trim().replace(/^#/, '')), 400);

        return () => clearTimeout(timer);
    }, [searchText]);

    const query = new URLSearchParams();

    if (search !== '') {
        query.set('search', search);
    }

    const deliveries = usePagedList<RecordedDelivery>(`/admin/deliveries?${query.toString()}`);
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
                    What arrived from Head Office, as the Specialist recorded it. View only.
                </Text>
            </View>

            <View className="flex-row items-center gap-2 rounded-full border border-slate-200 bg-white px-4">
                <Search size={17} color="#94a3b8" />
                <TextInput
                    value={searchText}
                    onChangeText={setSearchText}
                    maxLength={40}
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

            {deliveries.error && <LoadError message={deliveries.error} onRetry={deliveries.reload} className="" />}
        </View>
    );

    return (
        <FlatList
            className="flex-1 bg-page"
            contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32, paddingHorizontal: 16, gap: 10 }}
            data={deliveries.items ?? []}
            keyExtractor={(delivery) => String(delivery.id)}
            ListHeaderComponent={header}
            renderItem={({ item }) => <DeliveryRow delivery={item} />}
            onEndReached={deliveries.loadMore}
            onEndReachedThreshold={0.5}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} />}
            ListFooterComponent={deliveries.loadingMore ? <ActivityIndicator color="#0D6EFD" className="py-4" /> : null}
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
                        hint="A delivery shows here once the Specialist records it at Stock In."
                    />
                )
            }
            keyboardShouldPersistTaps="handled"
        />
    );
}
