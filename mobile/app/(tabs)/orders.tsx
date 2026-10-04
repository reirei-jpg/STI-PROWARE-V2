import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Banknote, CalendarClock, ImageIcon, Package } from 'lucide-react-native';
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

import OrderItemsList from '@/components/OrderItemsList';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatDateTime, formatPeso, formatUnits } from '@/lib/format';
import type { StudentOrder, StudentPreorder } from '@/lib/types';
import { usePagedList } from '@/lib/use-paged-list';

type Show = 'orders' | 'preorders';

const statusClasses: Record<StudentOrder['status'], [string, string]> = {
    placed: ['bg-blue-100', 'text-blue-800'],
    ready: ['bg-emerald-100', 'text-emerald-800'],
    picked_up: ['bg-slate-100', 'text-slate-700'],
    cancelled: ['bg-red-100', 'text-red-700'],
};

/**
 * My Orders and My Preorders, like the website, with a switch between them.
 * Orders not picked up yet come first; an order can be cancelled while it
 * is still Placed, a preorder while preorders for it are open.
 */
export default function OrdersScreen() {
    const insets = useSafeAreaInsets();
    // Kept in the address, so "See My Preorders" elsewhere opens that side.
    const params = useLocalSearchParams<{ show?: Show }>();
    const show: Show = params.show === 'preorders' ? 'preorders' : 'orders';
    const setShow = (next: Show): void => router.setParams({ show: next });
    const orders = usePagedList<StudentOrder>('/orders');
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
        <View className="gap-4 pb-4">
            <View>
                <Text className="font-sans-bold text-2xl text-slate-900">
                    {show === 'orders' ? 'My Orders' : 'My Preorders'}
                </Text>
                <Text className="mt-1 font-sans text-sm leading-5 text-slate-500">
                    {show === 'orders'
                        ? 'Pick up your order and pay in cash at the PROWARE office by its pick-up date, or it is cancelled.'
                        : 'Items you reserved. There is nothing to pay now; the PROWARE office uses preorders to know how many to order.'}
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
            gap: 12,
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
            renderItem={({ item }) => (
                <OrderCard order={item} onChanged={orders.replaceItem} />
            )}
            onEndReached={orders.loadMore}
            ListEmptyComponent={
                orders.items === null ? (
                    <ActivityIndicator color="#0D6EFD" className="mt-10" />
                ) : (
                    <EmptyBox
                        icon={<Package size={40} color="#cbd5e1" />}
                        title="No orders yet"
                        text="Add items to your cart, then tap Place Order."
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

function OrderCard({
    order,
    onChanged,
}: {
    order: StudentOrder;
    onChanged: (order: StudentOrder) => void;
}) {
    const { request } = useAuth();
    const [cancelling, setCancelling] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [badgeBg, badgeText] = statusClasses[order.status];
    const isOpen = order.status === 'placed' || order.status === 'ready';

    const cancel = (): void => {
        Alert.alert(
            `Cancel order ${order.number}?`,
            'The items go back to the store.',
            [
                { text: 'Keep it', style: 'cancel' },
                {
                    text: 'Cancel order',
                    style: 'destructive',
                    onPress: async () => {
                        setCancelling(true);
                        setError(null);

                        try {
                            const result = await request<{ order: StudentOrder }>(
                                `/orders/${order.id}/cancel`,
                                { method: 'POST' },
                            );

                            onChanged(result.order);
                        } catch (caught) {
                            setError(
                                caught instanceof ApiError
                                    ? caught.message
                                    : 'The order could not be cancelled. Please try again.',
                            );
                        } finally {
                            setCancelling(false);
                        }
                    },
                },
            ],
        );
    };

    return (
        <View
            className={`overflow-hidden rounded-3xl border border-slate-200 bg-white ${isOpen ? '' : 'opacity-75'}`}
        >
            <View className="flex-row items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <View className="flex-1">
                    <Text className="font-sans-bold text-lg text-slate-900">
                        Order {order.number}
                    </Text>
                    <Text className="font-sans text-xs text-slate-500">
                        Placed {formatDateTime(order.placed_at)}
                    </Text>
                </View>
                <View className={`rounded-full px-3 py-1 ${badgeBg}`}>
                    <Text className={`font-sans-bold text-xs ${badgeText}`}>
                        {order.status_label}
                    </Text>
                </View>
            </View>

            <OrderItemsList order={order} />

            <View className="gap-3 border-t border-slate-100 px-4 py-3">
                {isOpen ? (
                    <View className="flex-row items-start gap-2">
                        <Banknote size={18} color="#059669" />
                        <Text className="flex-1 font-sans text-sm leading-5 text-slate-700">
                            {order.status === 'ready'
                                ? 'Ready at the PROWARE office. '
                                : 'The PROWARE office is preparing it. '}
                            Pay{' '}
                            <Text className="font-sans-bold">
                                {formatPeso(order.total_centavos)}
                            </Text>{' '}
                            in cash when you pick it up, by{' '}
                            <Text className="font-sans-bold">{formatDate(order.pick_up_by)}</Text>.
                        </Text>
                    </View>
                ) : order.status === 'picked_up' ? (
                    <Text className="font-sans text-sm text-slate-600">
                        Picked up and paid {formatDateTime(order.picked_up_at)}.
                    </Text>
                ) : (
                    <Text className="font-sans text-sm text-slate-600">
                        Cancelled {formatDateTime(order.cancelled_at)}
                        {order.cancel_reason ? ` · ${order.cancel_reason}` : ''}
                    </Text>
                )}

                {error && (
                    <Text className="font-sans-semibold text-sm text-red-600">{error}</Text>
                )}

                {order.can_cancel && (
                    <CancelButton busy={cancelling} onPress={cancel}>
                        Cancel order
                    </CancelButton>
                )}
            </View>
        </View>
    );
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

    return (
        <View
            className={`gap-3 rounded-3xl border border-slate-200 bg-white p-4 ${preorder.status === 'cancelled' ? 'opacity-60' : ''}`}
        >
            <Pressable
                onPress={() => router.push(`/product/${preorder.product_id}`)}
                accessibilityRole="button"
                accessibilityLabel={`View ${preorder.product_name}`}
                className="flex-row items-center gap-3"
            >
                <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                    {preorder.photo_url ? (
                        <Image
                            source={{ uri: preorder.photo_url }}
                            style={{ width: 64, height: 64 }}
                            resizeMode="cover"
                        />
                    ) : (
                        <ImageIcon size={22} color="#cbd5e1" />
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
                    <Text className="font-sans text-xs text-slate-500">
                        {preorder.status_label} {formatDateTime(preorder.created_at)}
                        {preorder.status === 'active' && preorder.preorders_close_on
                            ? ` · preorders close ${formatDate(preorder.preorders_close_on)}`
                            : ''}
                    </Text>
                </View>
            </Pressable>

            {error && (
                <Text className="font-sans-semibold text-sm text-red-600">{error}</Text>
            )}

            {preorder.can_cancel && (
                <CancelButton busy={cancelling} onPress={cancel}>
                    Cancel preorder
                </CancelButton>
            )}
        </View>
    );
}

function CancelButton({
    busy,
    onPress,
    children,
}: {
    busy: boolean;
    onPress: () => void;
    children: ReactNode;
}) {
    return (
        <Pressable
            onPress={onPress}
            disabled={busy}
            accessibilityRole="button"
            className={`flex-row items-center justify-center gap-2 self-start rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 ${busy ? 'opacity-60' : ''}`}
        >
            {busy && <ActivityIndicator size="small" color="#b91c1c" />}
            <Text className="font-sans-bold text-sm text-red-700">{children}</Text>
        </Pressable>
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
