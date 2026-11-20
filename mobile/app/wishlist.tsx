import { router, useFocusEffect } from 'expo-router';
import { ArrowLeft, CalendarClock, Heart, ImageIcon, ShoppingCart, Trash2 } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Image, Pressable, RefreshControl, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LoadError from '@/components/LoadError';
import LoadingState from '@/components/LoadingState';
import PriceLines from '@/components/PriceLines';
import { ApiError, loadErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import type { WishlistRow } from '@/lib/types';

const TONES: Record<WishlistRow['status_tone'], string> = {
    green: 'text-emerald-700',
    amber: 'text-amber-700',
    red: 'text-red-600',
    blue: 'text-blue-700',
    slate: 'text-slate-500',
};

/**
 * My Wishlist, as on the website (panel revision, 20 Nov 2026): items saved
 * to buy later, newest first, with today's price and how many are left. Add
 * to Cart opens the item with its Add to Cart sheet and the saved size
 * chosen; a sold-out or Coming Soon item can be preordered. Nothing is held.
 */
export default function WishlistScreen() {
    const insets = useSafeAreaInsets();
    const { request } = useAuth();
    const [items, setItems] = useState<WishlistRow[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(
        () =>
            request<{ items: WishlistRow[] }>('/wishlist')
                .then((result) => {
                    setItems(result.items);
                    setError(null);
                })
                .catch((caught) => setError(loadErrorMessage(caught, 'Your wishlist could not be loaded.'))),
        [request],
    );

    useFocusEffect(
        useCallback(() => {
            void load();
        }, [load]),
    );

    const pullToRefresh = async (): Promise<void> => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    const remove = async (item: WishlistRow): Promise<void> => {
        try {
            const result = await request<{ message: string; items: WishlistRow[] }>(`/wishlist/${item.id}`, {
                method: 'DELETE',
            });

            setItems(result.items);
            setNotice(result.message);
        } catch (caught) {
            setNotice(caught instanceof ApiError ? caught.message : 'It could not be removed. Try again.');
        }
    };

    const confirmRemove = (item: WishlistRow): void => {
        const name = item.variant_label ? `${item.product_name} (${item.variant_label})` : item.product_name;

        Alert.alert(`Remove ${name} from your wishlist?`, 'You can add it again from the store.', [
            { text: 'Keep it', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => void remove(item) },
        ]);
    };

    const open = (item: WishlistRow): void =>
        router.push({
            pathname: '/product/[id]',
            params: { id: String(item.product_id), add: '1', variant: item.product_variant_id ? String(item.product_variant_id) : '' },
        });

    const header = (
        <View className="gap-3 pb-2">
            <Pressable
                onPress={() => router.back()}
                accessibilityRole="button"
                className="flex-row items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
                <ArrowLeft size={17} color="#334155" />
                <Text className="font-sans-bold text-sm text-slate-700">Back</Text>
            </Pressable>
            <Text className="font-sans-bold text-2xl text-slate-900">My Wishlist</Text>
            <Text className="font-sans text-sm text-slate-500">
                Items you saved to buy later. They are not held for you, so check how many are left.
            </Text>
            {notice && (
                <View className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <Text className="font-sans-semibold text-sm text-emerald-800">{notice}</Text>
                </View>
            )}
            {error && <LoadError message={error} onRetry={load} />}
        </View>
    );

    return (
        <FlatList
            className="flex-1 bg-page"
            contentContainerStyle={{
                paddingTop: insets.top + 12,
                paddingBottom: insets.bottom + 32,
                paddingHorizontal: 16,
                gap: 10,
            }}
            data={items ?? []}
            keyExtractor={(item) => String(item.id)}
            ListHeaderComponent={header}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} />}
            ListEmptyComponent={
                items === null ? (
                    error ? null : <LoadingState />
                ) : (
                    <View className="items-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12">
                        <Heart size={40} color="#cbd5e1" />
                        <Text className="mt-3 font-sans-bold text-lg text-slate-800">Your wishlist is empty</Text>
                        <Text className="mt-1 text-center font-sans text-sm text-slate-500">
                            In an item's Add to Cart sheet, tap Add to Wishlist to save it for later.
                        </Text>
                    </View>
                )
            }
            renderItem={({ item }) => (
                <View className="gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                    <View className="flex-row gap-3">
                        <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                            {item.photo_url ? (
                                <Image source={{ uri: item.photo_url }} style={{ width: 64, height: 64 }} resizeMode="cover" />
                            ) : (
                                <ImageIcon size={22} color="#cbd5e1" />
                            )}
                        </View>
                        <View className="flex-1 gap-0.5">
                            <Text className="font-sans-bold text-base text-slate-900">{item.product_name}</Text>
                            <Text className="font-sans text-sm text-slate-600">
                                {item.variant_label ?? 'No size or color chosen yet'}
                            </Text>
                            <PriceLines price={item.price} />
                            <Text className={`font-sans-bold text-sm ${TONES[item.status_tone]}`}>{item.status_text}</Text>
                            {item.added_on && (
                                <Text className="font-sans text-xs text-slate-400">Saved {formatDate(item.added_on)}</Text>
                            )}
                        </View>
                    </View>
                    <View className="flex-row gap-2">
                        {item.can_buy ? (
                            <Pressable
                                onPress={() => open(item)}
                                accessibilityRole="button"
                                className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-brand py-3"
                            >
                                <ShoppingCart size={16} color="#ffffff" />
                                <Text className="font-sans-bold text-sm text-white">Add to Cart</Text>
                            </Pressable>
                        ) : (
                            item.can_preorder && (
                                <Pressable
                                    onPress={() => open(item)}
                                    accessibilityRole="button"
                                    className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-amber-400 py-3"
                                >
                                    <CalendarClock size={16} color="#451a03" />
                                    <Text className="font-sans-bold text-sm text-amber-950">Preorder</Text>
                                </Pressable>
                            )
                        )}
                        <Pressable
                            onPress={() => confirmRemove(item)}
                            accessibilityRole="button"
                            className="flex-row items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3"
                        >
                            <Trash2 size={16} color="#dc2626" />
                            <Text className="font-sans-bold text-sm text-red-700">Remove</Text>
                        </Pressable>
                    </View>
                </View>
            )}
        />
    );
}
