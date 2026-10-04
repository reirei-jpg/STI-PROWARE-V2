import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Boxes, ChevronRight, ImageIcon, Search, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Pressable,
    RefreshControl,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatUnits } from '@/lib/format';
import type { StockListProduct } from '@/lib/types';
import { usePagedList } from '@/lib/use-paged-list';

/**
 * The Specialist's stock lookup: find a product by name, or show only those
 * low on stock (as the website's Low stock filter). Tapping one shows each
 * size or color's pieces and the latest changes.
 */
export default function StaffStockScreen() {
    const insets = useSafeAreaInsets();
    // Opened from the To-do's "See low stock".
    const params = useLocalSearchParams<{ low?: string }>();
    const lowOnly = params.low === '1';
    const setLowOnly = (next: boolean): void => router.setParams({ low: next ? '1' : '0' });
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

    if (lowOnly) {
        query.set('low', '1');
    }

    const products = usePagedList<StockListProduct>(`/specialist/stock?${query.toString()}`);
    const { reload } = products;

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
                <Text className="font-sans-bold text-2xl text-slate-900">Stock</Text>
                <Text className="mt-1 font-sans text-sm text-slate-500">
                    How many pieces are left, by size or color.
                </Text>
            </View>

            <View className="flex-row items-center gap-2 rounded-full border border-slate-200 bg-white px-4">
                <Search size={17} color="#94a3b8" />
                <TextInput
                    value={searchText}
                    onChangeText={setSearchText}
                    placeholder="Search a product"
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

            <View className="flex-row gap-2">
                {[
                    { value: false, label: 'All products' },
                    { value: true, label: 'Low stock only' },
                ].map((chip) => (
                    <Pressable
                        key={chip.label}
                        onPress={() => setLowOnly(chip.value)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: lowOnly === chip.value }}
                        className={`flex-1 items-center rounded-full border px-2 py-2.5 ${lowOnly === chip.value ? 'border-brand bg-brand' : 'border-slate-200 bg-white'}`}
                    >
                        <Text
                            numberOfLines={1}
                            className={`font-sans-bold text-xs ${lowOnly === chip.value ? 'text-white' : 'text-slate-600'}`}
                        >
                            {chip.label}
                        </Text>
                    </Pressable>
                ))}
            </View>

            {products.error && (
                <View className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                    <Text className="font-sans-semibold text-sm text-red-700">{products.error}</Text>
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
            data={products.items ?? []}
            keyExtractor={(product) => String(product.id)}
            ListHeaderComponent={header}
            renderItem={({ item }) => <ProductRow product={item} />}
            onEndReached={products.loadMore}
            onEndReachedThreshold={0.5}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} />}
            ListFooterComponent={
                products.loadingMore ? <ActivityIndicator color="#0D6EFD" className="py-4" /> : null
            }
            ListEmptyComponent={
                products.items === null ? (
                    <ActivityIndicator color="#0D6EFD" className="mt-10" />
                ) : (
                    <View className="items-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12">
                        <Boxes size={40} color="#cbd5e1" />
                        <Text className="mt-3 text-center font-sans-bold text-base text-slate-700">
                            {lowOnly && search === ''
                                ? 'Nothing is low on stock.'
                                : 'No product matches your search.'}
                        </Text>
                    </View>
                )
            }
            keyboardShouldPersistTaps="handled"
        />
    );
}

function ProductRow({ product }: { product: StockListProduct }) {
    const out = product.stock_on_hand === 0;

    return (
        <Pressable
            onPress={() => router.push(`/stock/${product.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`${product.name}, ${formatUnits(product.stock_on_hand, 'Piece')}`}
            style={{
                borderLeftWidth: 5,
                borderLeftColor: out ? '#f87171' : product.is_low ? '#f59e0b' : '#e2e8f0',
            }}
            className="flex-row items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3"
        >
            <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                {product.photo_url ? (
                    <Image source={{ uri: product.photo_url }} style={{ width: 56, height: 56 }} resizeMode="cover" />
                ) : (
                    <ImageIcon size={20} color="#cbd5e1" />
                )}
            </View>
            <View className="flex-1 gap-0.5">
                <Text numberOfLines={2} className="font-sans-bold text-sm text-slate-900">
                    {product.name}
                </Text>
                <Text className="font-sans text-xs text-slate-500">{product.status_label}</Text>
                <Text
                    className={`font-sans-bold text-sm ${out ? 'text-red-600' : product.is_low ? 'text-amber-600' : 'text-slate-800'}`}
                >
                    {formatUnits(product.stock_on_hand, 'Piece')}
                    {product.is_low ? ' · low' : ''}
                </Text>
            </View>
            <ChevronRight size={18} color="#94a3b8" />
        </Pressable>
    );
}
