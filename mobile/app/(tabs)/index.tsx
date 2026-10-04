import { router } from 'expo-router';
import { Clock, Flame, Search, Store, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    RefreshControl,
    Text,
    TextInput,
    View,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ComingSoonBanner from '@/components/ComingSoonBanner';
import OnSaleCarousel from '@/components/OnSaleCarousel';
import ProductTile from '@/components/ProductTile';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Page, StorefrontHome, StorefrontTileProduct } from '@/lib/types';

type Show = 'in_stock' | 'sold_out' | null;

const CHIPS: { value: Show; label: string }[] = [
    { value: null, label: 'All' },
    { value: 'in_stock', label: 'Available' },
    { value: 'sold_out', label: 'Out of Stock' },
];

const SIDE = 16;
const GAP = 12;

/**
 * Home: the storefront, like the website. Coming Soon (one item at a time),
 * On Sale (one swipeable row), and All Merchandise (newest first, out of stock last) with a
 * search and Available / Out of Stock. More loads as the student scrolls.
 */
export default function HomeScreen() {
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const { user, request } = useAuth();

    const tileWidth = Math.floor((width - SIDE * 2 - GAP) / 2);
    const firstName = user?.name.split(' ')[0] ?? '';

    const [home, setHome] = useState<StorefrontHome | null>(null);
    const [items, setItems] = useState<StorefrontTileProduct[]>([]);
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [search, setSearch] = useState('');
    const [show, setShow] = useState<Show>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const latestRequest = useRef(0);

    const loadMerchandise = useCallback(
        async (pageToLoad: number, term: string, filter: Show) => {
            const requestNumber = ++latestRequest.current;
            const query = new URLSearchParams({ page: String(pageToLoad) });

            if (term.trim() !== '') {
                query.set('search', term.trim());
            }

            if (filter) {
                query.set('show', filter);
            }

            const result = await request<Page<StorefrontTileProduct>>(
                `/merchandise?${query.toString()}`,
            );

            // An older search answering late must not replace a newer one.
            if (requestNumber !== latestRequest.current) {
                return;
            }

            setItems((current) =>
                pageToLoad === 1 ? result.data : [...current, ...result.data],
            );
            setPage(result.current_page);
            setLastPage(result.last_page);
        },
        [request],
    );

    const loadAll = useCallback(async () => {
        setError(null);

        try {
            const [sections] = await Promise.all([
                request<StorefrontHome>('/storefront'),
                loadMerchandise(1, search, show),
            ]);

            setHome(sections);
        } catch (caught) {
            setError(
                caught instanceof ApiError
                    ? caught.message
                    : 'The store could not be loaded. Pull down to try again.',
            );
        }
        // Reloading everything uses the search and filter of the moment.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [request, loadMerchandise]);

    useEffect(() => {
        void loadAll();
    }, [loadAll]);

    // Search as the student types, after a short pause.
    const firstSearch = useRef(true);

    useEffect(() => {
        if (firstSearch.current) {
            firstSearch.current = false;

            return;
        }

        const timer = setTimeout(() => {
            loadMerchandise(1, search, show).catch(() =>
                setError('The search could not be done. Try again.'),
            );
        }, 400);

        return () => clearTimeout(timer);
    }, [search, show, loadMerchandise]);

    const refresh = async (): Promise<void> => {
        setRefreshing(true);
        await loadAll();
        setRefreshing(false);
    };

    const loadMore = async (): Promise<void> => {
        if (loadingMore || page >= lastPage) {
            return;
        }

        setLoadingMore(true);

        try {
            await loadMerchandise(page + 1, search, show);
        } catch {
            // Scrolling again will retry.
        } finally {
            setLoadingMore(false);
        }
    };

    const open = (product: StorefrontTileProduct): void => {
        router.push(`/product/${product.id}`);
    };

    const isFiltered = search.trim() !== '' || show !== null;

    const header = (
        <View className="gap-6 pb-4">
            <View className="rounded-3xl bg-brand px-5 py-6">
                <Text className="font-sans-semibold text-xs uppercase tracking-wide text-blue-100">
                    STI PROWARE
                </Text>
                <Text className="mt-1 font-sans-bold text-2xl text-white">
                    Hi, {firstName}
                </Text>
                <Text className="mt-1 font-sans text-sm leading-5 text-blue-50">
                    Official STI merchandise. Pay in cash when you pick it
                    up at the PROWARE office.
                </Text>
            </View>

            {error && (
                <View className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                    <Text className="font-sans-semibold text-sm text-red-700">
                        {error}
                    </Text>
                </View>
            )}

            <View>
                <SectionTitle
                    icon={<Clock size={18} color="#d97706" />}
                    iconClass="bg-amber-100"
                    title="Coming Soon"
                    description="Ordered from STI Head Office and on the way."
                />
                {home === null ? (
                    <LoadingBox />
                ) : home.coming_soon.length === 0 ? (
                    <EmptyNote>
                        No preorders yet. New items appear here as soon as
                        they are set for preorder.
                    </EmptyNote>
                ) : (
                    <ComingSoonBanner
                        products={home.coming_soon}
                        width={width - SIDE * 2}
                        onOpen={open}
                    />
                )}
            </View>

            <View className="rounded-3xl border border-red-100 bg-red-50/60 p-3">
                <SectionTitle
                    icon={<Flame size={18} color="#ffffff" />}
                    iconClass="bg-red-500"
                    title="On Sale"
                    description="Limited stock at a lower price."
                />
                {home === null ? (
                    <LoadingBox />
                ) : home.on_sale.length === 0 ? (
                    <EmptyNote>
                        Nothing on sale right now. Check back for lower
                        prices.
                    </EmptyNote>
                ) : (
                    <OnSaleCarousel
                        products={home.on_sale}
                        width={width - SIDE * 2 - 24}
                        onOpen={open}
                    />
                )}
            </View>

            <View className="gap-3">
                <SectionTitle
                    icon={<Store size={18} color="#2563eb" />}
                    iconClass="bg-blue-100"
                    title="All Merchandise"
                    description="Everything available at the PROWARE store."
                />

                <View className="flex-row items-center gap-2 rounded-full border border-slate-200 bg-white px-4">
                    <Search size={17} color="#94a3b8" />
                    <TextInput
                        value={search}
                        onChangeText={setSearch}
                        placeholder="Search merchandise"
                        placeholderTextColor="#94a3b8"
                        autoCorrect={false}
                        returnKeyType="search"
                        className="flex-1 py-3 font-sans-medium text-sm text-slate-900"
                    />
                    {search !== '' && (
                        <Pressable
                            onPress={() => setSearch('')}
                            accessibilityLabel="Clear search"
                            hitSlop={10}
                        >
                            <X size={17} color="#64748b" />
                        </Pressable>
                    )}
                </View>

                {/* Equal widths with room to spare: Android can measure a
                    label a little short and drop its last word ("Out of"). */}
                <View className="flex-row gap-2">
                    {CHIPS.map((chip) => (
                        <Pressable
                            key={chip.label}
                            onPress={() => setShow(chip.value)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: show === chip.value }}
                            className={`flex-1 items-center rounded-full border px-2 py-2.5 ${show === chip.value ? 'border-brand bg-brand' : 'border-slate-200 bg-white'}`}
                        >
                            <Text
                                numberOfLines={1}
                                className={`font-sans-bold text-xs ${show === chip.value ? 'text-white' : 'text-slate-600'}`}
                            >
                                {chip.label}
                            </Text>
                        </Pressable>
                    ))}
                </View>
            </View>
        </View>
    );

    return (
        <FlatList
            className="flex-1 bg-page"
            data={items}
            keyExtractor={(product) => String(product.id)}
            numColumns={2}
            columnWrapperStyle={{ gap: GAP }}
            contentContainerStyle={{
                gap: GAP,
                paddingTop: insets.top + 16,
                paddingBottom: 32,
                paddingHorizontal: SIDE,
            }}
            ListHeaderComponent={header}
            renderItem={({ item }) => (
                <ProductTile product={item} width={tileWidth} onOpen={open} />
            )}
            ListEmptyComponent={
                home === null ? null : (
                    <EmptyNote>
                        {isFiltered
                            ? 'No merchandise matches your search. Try another name, or choose All.'
                            : 'No merchandise yet. New items appear here as soon as they arrive at the PROWARE store.'}
                    </EmptyNote>
                )
            }
            ListFooterComponent={
                loadingMore ? (
                    <View className="items-center py-4">
                        <ActivityIndicator color="#0D6EFD" />
                    </View>
                ) : null
            }
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={refresh} />
            }
            keyboardShouldPersistTaps="handled"
        />
    );
}

function SectionTitle({
    icon,
    iconClass,
    title,
    description,
}: {
    icon: React.ReactNode;
    iconClass: string;
    title: string;
    description: string;
}) {
    return (
        <View className="mb-3 flex-row items-center gap-3">
            <View
                className={`h-9 w-9 items-center justify-center rounded-xl ${iconClass}`}
            >
                {icon}
            </View>
            <View className="flex-1">
                <Text className="font-sans-bold text-lg text-slate-900">
                    {title}
                </Text>
                <Text className="font-sans text-xs text-slate-500">
                    {description}
                </Text>
            </View>
        </View>
    );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
    return (
        <View className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6">
            <Text className="text-center font-sans-semibold text-sm text-slate-500">
                {children}
            </Text>
        </View>
    );
}

function LoadingBox() {
    return (
        <View className="items-center rounded-2xl bg-white py-10">
            <ActivityIndicator color="#0D6EFD" />
        </View>
    );
}
