import { router, useFocusEffect } from 'expo-router';
import { Bell, CircleCheck, Clock, Flame, LogIn, Search, Shirt, Store, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Pressable,
    RefreshControl,
    Text,
    TextInput,
    View,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ProductRow from '@/components/ProductRow';
import ProductTile from '@/components/ProductTile';
import UniformSetSheet from '@/components/UniformSetSheet';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatPeso } from '@/lib/format';
import { useNotifications } from '@/lib/notifications';
import type { Page, StorefrontHome, StorefrontTileProduct, StorefrontUniformSet } from '@/lib/types';

type Show = 'in_stock' | 'sold_out' | null;

const CHIPS: { value: Show; label: string }[] = [
    { value: null, label: 'All' },
    { value: 'in_stock', label: 'Available' },
    { value: 'sold_out', label: 'Out of Stock' },
];

const SIDE = 16;
const GAP = 12;

/**
 * Home: the storefront, like the website. Coming Soon (open preorders
 * first) and On Sale as swipeable rows of full tiles, Uniform Sets (Buy
 * the Set opens its picker), and All Merchandise (newest first, out of
 * stock last) with Available / Out of Stock. More loads as the student
 * scrolls. The search at the top covers every section; while searching,
 * sections with no match are hidden.
 */
export default function HomeScreen() {
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const { user, request } = useAuth();
    const { unreadCount, refresh: refreshNotifications } = useNotifications();

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
    const [buyingSet, setBuyingSet] = useState<StorefrontUniformSet | null>(null);
    const [setNotice, setSetNotice] = useState<string | null>(null);
    const latestRequest = useRef(0);
    const latestSections = useRef(0);

    // Coming Soon, On Sale and Uniform Sets, only what matches the search.
    const loadSections = useCallback(
        async (term: string) => {
            const requestNumber = ++latestSections.current;
            const query = term.trim() !== '' ? `?${new URLSearchParams({ search: term.trim() }).toString()}` : '';
            const sections = await request<StorefrontHome>(`/storefront${query}`);

            if (requestNumber === latestSections.current) {
                setHome(sections);
            }
        },
        [request],
    );

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
            await Promise.all([loadSections(search), loadMerchandise(1, search, show)]);
        } catch (caught) {
            setError(
                caught instanceof ApiError
                    ? caught.message
                    : 'The store could not be loaded. Pull down to try again.',
            );
        }
        // Reloading everything uses the search and filter of the moment.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadSections, loadMerchandise]);

    useEffect(() => {
        void loadAll();
    }, [loadAll]);

    // Coming back to Home (from a product, the Cart, Orders) shows Coming
    // Soon and On Sale as they are now on the website, without losing the
    // student's place in All Merchandise. The first visit is loadAll's.
    const firstFocus = useRef(true);
    const searchNow = useRef(search);
    searchNow.current = search;

    useFocusEffect(
        useCallback(() => {
            if (firstFocus.current) {
                firstFocus.current = false;

                return;
            }

            loadSections(searchNow.current).catch(() => undefined);

            if (user) {
                refreshNotifications().catch(() => undefined);
            }
        }, [user, loadSections, refreshNotifications]),
    );

    // Search every section as the student types, after a short pause.
    // Available / Out of Stock is only for All Merchandise.
    const firstSearch = useRef(true);
    const searchedSections = useRef(search);

    useEffect(() => {
        if (firstSearch.current) {
            firstSearch.current = false;

            return;
        }

        const timer = setTimeout(() => {
            const loads = [loadMerchandise(1, search, show)];

            if (searchedSections.current !== search) {
                searchedSections.current = search;
                loads.push(loadSections(search));
            }

            Promise.all(loads).catch(() =>
                setError('The search could not be done. Try again.'),
            );
        }, 400);

        return () => clearTimeout(timer);
    }, [search, show, loadMerchandise, loadSections]);

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

    const isSearching = search.trim() !== '';
    const isFiltered = isSearching || show !== null;
    const otherSectionsMatch =
        home !== null && home.coming_soon.length + home.on_sale.length + home.uniform_sets.length > 0;

    const header = (
        <View className="gap-6 pb-4">
            <View className="rounded-3xl bg-brand px-5 py-6">
                <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                        <Text className="font-sans-semibold text-xs uppercase tracking-wide text-blue-100">
                            STI PROWARE
                        </Text>
                        <Text className="mt-1 font-sans-bold text-2xl text-white">
                            {user ? `Hi, ${firstName}` : 'Official STI merchandise'}
                        </Text>
                    </View>
                    {user === null ? (
                        <Pressable
                            onPress={() => router.push('/login')}
                            accessibilityRole="button"
                            className="flex-row items-center gap-1.5 rounded-2xl bg-white px-3.5 py-2.5"
                        >
                            <LogIn size={16} color="#0D6EFD" />
                            <Text className="font-sans-bold text-sm text-brand">Sign in</Text>
                        </Pressable>
                    ) : (
                    <Pressable
                        onPress={() => router.push('/notifications')}
                        accessibilityRole="button"
                        accessibilityLabel={
                            unreadCount > 0
                                ? `Notifications, ${unreadCount} unread`
                                : 'Notifications'
                        }
                        className="h-11 w-11 items-center justify-center rounded-2xl bg-white/15"
                    >
                        <Bell size={22} color="#ffffff" />
                        {unreadCount > 0 && (
                            <View className="absolute -right-1 -top-1 min-w-5 items-center rounded-full border-2 border-brand bg-red-500 px-1">
                                <Text className="font-sans-bold text-[10px] text-white">
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </Text>
                            </View>
                        )}
                    </Pressable>
                    )}
                </View>
                <Text className="mt-1 font-sans text-sm leading-5 text-blue-50">
                    {user
                        ? 'Official STI merchandise. Pay at the cashier, then get your items at the PROWARE office with your receipt.'
                        : 'Browse freely. Sign in with your STI email when you add something to your cart.'}
                </Text>
            </View>

            {/* The search covers every section, so it sits above them. */}
            <View className="flex-row items-center gap-2 rounded-full border border-slate-200 bg-white px-4">
                <Search size={17} color="#94a3b8" />
                <TextInput
                    value={search}
                    onChangeText={setSearch} maxLength={120}
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

            {error && (
                <View className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                    <Text className="font-sans-semibold text-sm text-red-700">
                        {error}
                    </Text>
                </View>
            )}

            {!(isSearching && home !== null && home.coming_soon.length === 0) && (
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
                    <ProductRow
                        products={[...home.coming_soon].sort(
                            (a, b) => Number(b.accepts_preorders) - Number(a.accepts_preorders),
                        )}
                        width={width - SIDE * 2}
                        onOpen={open}
                        hintClass="text-amber-700"
                        hintColor="#b45309"
                    />
                )}
            </View>
            )}

            {!(isSearching && home !== null && home.on_sale.length === 0) && (
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
                    <ProductRow
                        products={home.on_sale}
                        width={width - SIDE * 2 - 24}
                        onOpen={open}
                        hintClass="text-red-700"
                        hintColor="#b91c1c"
                    />
                )}
            </View>
            )}

            {home !== null && home.uniform_sets.length > 0 && (
                <View className="rounded-3xl border border-blue-100 bg-blue-50/60 p-3">
                    <SectionTitle
                        icon={<Shirt size={18} color="#ffffff" />}
                        iconClass="bg-brand"
                        title="Uniform Sets"
                        description="The whole uniform in one go, in your sizes."
                    />
                    {setNotice && (
                        <View className="mb-3 gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                            <View className="flex-row items-start gap-2">
                                <CircleCheck size={18} color="#047857" />
                                <Text className="flex-1 font-sans-semibold text-sm text-emerald-800">
                                    {setNotice}
                                </Text>
                            </View>
                            <Pressable
                                onPress={() => router.navigate('/cart')}
                                accessibilityRole="button"
                                className="self-start rounded-xl border border-emerald-300 bg-white px-4 py-2"
                            >
                                <Text className="font-sans-bold text-sm text-emerald-800">View Cart</Text>
                            </Pressable>
                        </View>
                    )}
                    <View className="gap-2.5">
                        {home.uniform_sets.map((set) => (
                            <View
                                key={set.id}
                                className="flex-row items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3"
                            >
                                <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                                    {set.photo_url ? (
                                        <Image
                                            source={{ uri: set.photo_url }}
                                            style={{ width: 64, height: 64 }}
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <Shirt size={22} color="#cbd5e1" />
                                    )}
                                </View>
                                <View className="flex-1 gap-0.5">
                                    <Text className="font-sans-bold text-sm text-slate-900">{set.name}</Text>
                                    <Text className="font-sans text-xs text-slate-500">
                                        {set.options
                                            .map(
                                                (item) =>
                                                    `${item.label}: ${item.top.kind} + ${item.bottoms.map((piece) => piece.kind).join(' or ')}`,
                                            )
                                            .join(' · ')}
                                    </Text>
                                    <Text className="font-sans-bold text-sm text-blue-700">
                                        {set.price_from ? (
                                            <Text className="font-sans text-xs text-slate-500">From </Text>
                                        ) : null}
                                        {formatPeso(set.price_centavos)}
                                        <Text className="font-sans text-xs text-slate-500"> / set</Text>
                                    </Text>
                                </View>
                                <Pressable
                                    onPress={() => {
                                        if (user === null) {
                                            router.push('/login');

                                            return;
                                        }

                                        setSetNotice(null);
                                        setBuyingSet(set);
                                    }}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Buy the ${set.name}`}
                                    className="rounded-xl bg-brand px-3 py-2.5"
                                >
                                    <Text className="font-sans-bold text-xs text-white">Buy the Set</Text>
                                </Pressable>
                            </View>
                        ))}
                    </View>
                </View>
            )}

            <View className="gap-3">
                <SectionTitle
                    icon={<Store size={18} color="#2563eb" />}
                    iconClass="bg-blue-100"
                    title="All Merchandise"
                    description="Everything available at the PROWARE store."
                />

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
        <>
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
                        {isSearching && show === null && otherSectionsMatch
                            ? `No other merchandise matches “${search.trim()}”. The matches are above.`
                            : isFiltered
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
        <UniformSetSheet
            set={buyingSet}
            onClose={() => setBuyingSet(null)}
            onAdded={(message) => {
                setBuyingSet(null);
                setSetNotice(message);
                // The stock may have changed since the page opened.
                void loadAll();
            }}
        />
        </>
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
