import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { CalendarClock, ChevronRight, ImageIcon, Package } from 'lucide-react-native';
import { useCallback, useState, type ReactNode } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Pressable,
    RefreshControl,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import OrderStatusPill, {
    dateTierClasses,
    orderNote,
    orderStripeColors,
} from '@/components/OrderStatusPill';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { dueDateTier, formatDate, formatPeso, formatUnits } from '@/lib/format';
import type { StudentOrder, StudentPreorder } from '@/lib/types';
import { usePagedList } from '@/lib/use-paged-list';

type Show = 'orders' | 'preorders';

/**
 * My Orders and My Preorders, with a switch between them. My Orders shows
 * Waiting orders (the most urgent pick-up date first) or Past ones, each
 * one short row (number, status, total, pick-up date); tapping it opens the
 * order with its issuance slip, items and Cancel.
 */
export default function OrdersScreen() {
    const insets = useSafeAreaInsets();
    // Kept in the address, so "See My Preorders" elsewhere opens that side.
    const params = useLocalSearchParams<{ show?: Show }>();
    const show: Show = params.show === 'preorders' ? 'preorders' : 'orders';
    const setShow = (next: Show): void => router.setParams({ show: next });
    // My Orders: Waiting (not released yet) first, or Past.
    const [ordersTab, setOrdersTab] = useState<'waiting' | 'past'>('waiting');
    const orders = usePagedList<StudentOrder, { counts: { waiting: number; past: number } }>(
        `/orders?show=${ordersTab}`,
    );
    const counts = orders.extra?.counts;
    const preorders = usePagedList<StudentPreorder>('/preorders');
    const [refreshing, setRefreshing] = useState(false);

    const active = show === 'orders' ? orders : preorders;
    const { reload } = active;

    // Coming back here shows what changed meanwhile (for example, Ready).
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
        <View className="gap-4 pb-2">
            <View>
                <Text className="font-sans-bold text-2xl text-slate-900">Orders</Text>
                <Text className="mt-1 font-sans text-sm text-slate-500">
                    {show === 'orders'
                        ? 'Show the issuance slip at the PROWARE office by the pick-up date, and pay there.'
                        : 'Reserved items. Nothing to pay now.'}
                </Text>
            </View>

            <View className="flex-row rounded-2xl border border-slate-200 bg-white p-1">
                <SwitchButton chosen={show === 'orders'} onPress={() => setShow('orders')}>
                    My Orders
                </SwitchButton>
                <SwitchButton
                    chosen={show === 'preorders'}
                    onPress={() => setShow('preorders')}
                >
                    My Preorders
                </SwitchButton>
            </View>

            {show === 'orders' && (
                <View className="flex-row gap-2">
                    {(['waiting', 'past'] as const).map((tab) => {
                        const chosen = ordersTab === tab;
                        const count = counts?.[tab];

                        return (
                            <Pressable
                                key={tab}
                                onPress={() => setOrdersTab(tab)}
                                accessibilityRole="button"
                                accessibilityState={{ selected: chosen }}
                                className={`flex-row items-center gap-1.5 rounded-full border px-4 py-2 ${chosen ? 'border-brand bg-brand' : 'border-slate-200 bg-white'}`}
                            >
                                <Text
                                    className={`font-sans-bold text-xs ${chosen ? 'text-white' : 'text-slate-600'}`}
                                >
                                    {tab === 'waiting' ? 'Waiting' : 'Past'}
                                </Text>
                                {count != null && (
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
                </View>
            )}

            {active.error && (
                <View className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                    <Text className="font-sans-semibold text-sm text-red-700">
                        {active.error}
                    </Text>
                </View>
            )}
        </View>
    );

    const common = {
        className: 'flex-1 bg-page',
        contentContainerStyle: {
            paddingTop: insets.top + 16,
            paddingBottom: 32,
            paddingHorizontal: 16,
            gap: 10,
        },
        ListHeaderComponent: header,
        onEndReachedThreshold: 0.5,
        refreshControl: <RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} />,
        ListFooterComponent: active.loadingMore ? (
            <ActivityIndicator color="#0D6EFD" className="py-4" />
        ) : null,
    };

    return show === 'orders' ? (
        <FlatList
            {...common}
            key="orders"
            data={orders.items ?? []}
            keyExtractor={(order) => String(order.id)}
            renderItem={({ item }) => <OrderRow order={item} />}
            onEndReached={orders.loadMore}
            ListEmptyComponent={
                orders.items === null ? (
                    <ActivityIndicator color="#0D6EFD" className="mt-10" />
                ) : (
                    <EmptyBox
                        icon={<Package size={40} color="#cbd5e1" />}
                        title={ordersTab === 'waiting' ? 'No orders waiting' : 'No past orders yet'}
                        text={
                            ordersTab === 'waiting'
                                ? 'Add items to your cart, then tap Place Order.'
                                : 'Released and cancelled orders show here.'
                        }
                    />
                )
            }
        />
    ) : (
        <FlatList
            {...common}
            key="preorders"
            data={preorders.items ?? []}
            keyExtractor={(preorder) => String(preorder.id)}
            renderItem={({ item }) => (
                <PreorderRow preorder={item} onChanged={preorders.replaceItem} />
            )}
            onEndReached={preorders.loadMore}
            ListEmptyComponent={
                preorders.items === null ? (
                    <ActivityIndicator color="#0D6EFD" className="mt-10" />
                ) : (
                    <EmptyBox
                        icon={<CalendarClock size={40} color="#cbd5e1" />}
                        title="No preorders yet"
                        text="Tap Preorder on an item under Coming Soon to reserve it."
                    />
                )
            }
        />
    );
}

function OrderRow({ order }: { order: StudentOrder }) {
    const isOpen = order.status === 'placed' || order.status === 'ready';
    const note = orderNote(order);
    const itemCount = order.items.length;

    return (
        <Pressable
            onPress={() => router.push(`/order/${order.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Order ${order.number}, ${order.status_label}`}
            style={{ borderLeftWidth: 5, borderLeftColor: orderStripeColors[order.status] }}
            className={`flex-row items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 ${isOpen ? '' : 'opacity-70'}`}
        >
            <View className="flex-1 gap-1">
                <View className="flex-row items-center justify-between gap-2">
                    <Text className="font-sans-bold text-base text-slate-900">
                        {order.number}
                    </Text>
                    <OrderStatusPill order={order} />
                </View>
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

/** When preorders close (date-colored while it can still be changed). */
function preorderNote(preorder: StudentPreorder): { text: string; className: string } {
    if (preorder.status === 'cancelled') {
        return { text: 'Cancelled', className: 'font-sans text-slate-500' };
    }

    if (preorder.preorders_close_on === null) {
        return { text: preorder.status_label, className: 'font-sans text-slate-500' };
    }

    const tier = dueDateTier(preorder.preorders_close_on);

    // Closed preorders still count; there is nothing for the student to do.
    return tier === 'overdue'
        ? {
              text: `Preorders closed ${formatDate(preorder.preorders_close_on)}`,
              className: 'font-sans text-slate-500',
          }
        : {
              text:
                  tier === 'today'
                      ? 'Preorders close today'
                      : `Preorders close ${formatDate(preorder.preorders_close_on)}`,
              className: dateTierClasses[tier],
          };
}

function PreorderRow({
    preorder,
    onChanged,
}: {
    preorder: StudentPreorder;
    onChanged: (preorder: StudentPreorder) => void;
}) {
    const { request } = useAuth();
    const [cancelling, setCancelling] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const cancel = (): void => {
        Alert.alert('Cancel this preorder?', preorder.product_name, [
            { text: 'Keep it', style: 'cancel' },
            {
                text: 'Cancel preorder',
                style: 'destructive',
                onPress: async () => {
                    setCancelling(true);
                    setError(null);

                    try {
                        const result = await request<{ preorder: StudentPreorder }>(
                            `/preorders/${preorder.id}`,
                            { method: 'DELETE' },
                        );

                        onChanged(result.preorder);
                    } catch (caught) {
                        setError(
                            caught instanceof ApiError
                                ? caught.message
                                : 'The preorder could not be cancelled. Please try again.',
                        );
                    } finally {
                        setCancelling(false);
                    }
                },
            },
        ]);
    };

    const closing = preorderNote(preorder);

    return (
        <View
            style={{
                borderLeftWidth: 5,
                borderLeftColor: preorder.status === 'cancelled' ? '#f87171' : '#fbbf24',
            }}
            className={`gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 ${preorder.status === 'cancelled' ? 'opacity-60' : ''}`}
        >
            <Pressable
                onPress={() => router.push(`/product/${preorder.product_id}`)}
                accessibilityRole="button"
                accessibilityLabel={`View ${preorder.product_name}`}
                className="flex-row items-center gap-3"
            >
                <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                    {preorder.photo_url ? (
                        <Image
                            source={{ uri: preorder.photo_url }}
                            style={{ width: 56, height: 56 }}
                            resizeMode="cover"
                        />
                    ) : (
                        <ImageIcon size={20} color="#cbd5e1" />
                    )}
                </View>
                <View className="flex-1 gap-0.5">
                    <Text className="font-sans-bold text-base text-slate-900">
                        {preorder.product_name}
                    </Text>
                    <Text className="font-sans text-sm text-slate-600">
                        {preorder.variant_label ? `${preorder.variant_label} · ` : ''}
                        {formatUnits(preorder.quantity, 'Piece')}
                    </Text>
                    <Text className={`text-xs ${closing.className}`}>{closing.text}</Text>
                </View>
            </Pressable>

            {error && (
                <Text className="font-sans-semibold text-sm text-red-600">{error}</Text>
            )}

            {preorder.can_cancel && (
                <Pressable
                    onPress={cancel}
                    disabled={cancelling}
                    accessibilityRole="button"
                    className={`flex-row items-center justify-center gap-2 self-start rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 ${cancelling ? 'opacity-60' : ''}`}
                >
                    {cancelling && <ActivityIndicator size="small" color="#b91c1c" />}
                    <Text className="font-sans-bold text-sm text-red-700">Cancel preorder</Text>
                </Pressable>
            )}
        </View>
    );
}

function SwitchButton({
    chosen,
    onPress,
    children,
}: {
    chosen: boolean;
    onPress: () => void;
    children: ReactNode;
}) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected: chosen }}
            className={`flex-1 items-center rounded-xl py-2.5 ${chosen ? 'bg-brand' : ''}`}
        >
            <Text
                className={`font-sans-bold text-sm ${chosen ? 'text-white' : 'text-slate-600'}`}
            >
                {children}
            </Text>
        </Pressable>
    );
}

function EmptyBox({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
    return (
        <View className="items-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12">
            {icon}
            <Text className="mt-3 font-sans-bold text-lg text-slate-800">{title}</Text>
            <Text className="mt-1 text-center font-sans text-sm text-slate-500">{text}</Text>
            <Pressable
                onPress={() => router.navigate('/')}
                accessibilityRole="button"
                className="mt-5 rounded-2xl bg-brand px-6 py-3"
            >
                <Text className="font-sans-bold text-sm text-white">Go to the store</Text>
            </Pressable>
        </View>
    );
}
