import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { CalendarClock, ChevronRight, ImageIcon, Package, Pencil, ShoppingBag, Store, XCircle } from 'lucide-react-native';
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
    orderNote,
    orderStripeColors,
} from '@/components/OrderStatusPill';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import CenteredToast, { type ToastMessage } from '@/components/CenteredToast';
import EditPreorderSheet from '@/components/EditPreorderSheet';
import HeldOrderSheet from '@/components/HeldOrderSheet';
import LoadError from '@/components/LoadError';
import LoadingState from '@/components/LoadingState';
import SignInPrompt from '@/components/SignInPrompt';
import { formatDateTime, formatPeso } from '@/lib/format';
import { preorderPriceNote } from '@/lib/preorder-price';
import type { StudentOrder, StudentPreorder } from '@/lib/types';
import { usePagedList } from '@/lib/use-paged-list';

type Show = 'orders' | 'preorders';

/**
 * The Orders tab: the student's orders and preorders, or Sign in while
 * browsing without an account.
 */
export default function OrdersTab() {
    const { user } = useAuth();

    return user ? (
        <OrdersScreen />
    ) : (
        <SignInPrompt title="Orders" icon={<Package size={28} color="#2563eb" />}>
            Sign in with your STI email to see your orders, issuance slips and preorders.
        </SignInPrompt>
    );
}

/**
 * My Orders and My Preorders, with a switch between them. My Orders shows
 * Active Orders (the most urgent pick-up date first) or Order History, as
 * the website names them, each
 * one short row (number, status, total, pick-up date); tapping it opens the
 * order with its issuance slip, items and Cancel.
 */
function OrdersScreen() {
    const insets = useSafeAreaInsets();
    // Kept in the address, so "See My Preorders" elsewhere opens that side.
    const params = useLocalSearchParams<{ show?: Show }>();
    const show: Show = params.show === 'preorders' ? 'preorders' : 'orders';
    const setShow = (next: Show): void => router.setParams({ show: next });
    // My Orders: Active Orders (not released yet) first, or Order History.
    const [ordersTab, setOrdersTab] = useState<'waiting' | 'past'>('waiting');
    const orders = usePagedList<StudentOrder, { counts: { waiting: number; past: number } }>(
        `/orders?show=${ordersTab}`,
    );
    const counts = orders.extra?.counts;
    const preorders = usePagedList<StudentPreorder>('/preorders');
    const [refreshing, setRefreshing] = useState(false);
    // The preorder being changed, and what happened after.
    const [editing, setEditing] = useState<StudentPreorder | null>(null);
    const [toast, setToast] = useState<ToastMessage | null>(null);
    const closeToast = useCallback(() => setToast(null), []);

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
                        ? 'Pay at the cashier, then show the receipt and the issuance slip at the PROWARE office by the pick-up date.'
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
                                    {tab === 'waiting' ? 'Active Orders' : 'Order History'}
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
                <LoadError message={active.error} onRetry={active.reload} className="" />
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
                orders.error || orders.items === null ? (
                    orders.error ? null : <LoadingState />
                ) : (
                    <EmptyBox
                        icon={<Package size={40} color="#cbd5e1" />}
                        title={ordersTab === 'waiting' ? 'No active orders' : 'No order history yet'}
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
        <View className="flex-1">
            <FlatList
                {...common}
                key="preorders"
                data={batchesOf(preorders.items ?? [])}
                keyExtractor={(batch) => batch.key}
                renderItem={({ item }) => (
                    <PreorderBatch rows={item.rows} onChanged={preorders.replaceItem} onEdit={setEditing} />
                )}
                onEndReached={preorders.loadMore}
                ListEmptyComponent={
                    preorders.error || preorders.items === null ? (
                        preorders.error ? null : <LoadingState />
                    ) : (
                        <EmptyBox
                            icon={<CalendarClock size={40} color="#cbd5e1" />}
                            title="No preorders yet"
                            text="Tap Preorder on an item under Coming Soon to reserve it."
                        />
                    )
                }
            />
            <EditPreorderSheet
                preorder={editing}
                onClose={() => setEditing(null)}
                onSaved={(message, changed) => {
                    setEditing(null);
                    preorders.replaceItem(changed);
                    setToast({ type: 'success', message });
                    // Early-bird pieces of the other preorders may have moved too.
                    void preorders.reload();
                }}
            />
            <CenteredToast toast={toast} onClose={closeToast} />
        </View>
    );
}

function OrderRow({ order }: { order: StudentOrder }) {
    const isOpen = order.status === 'placed';
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

/** Preorders placed with one press of Preorder, one after another in the list. */
function batchesOf(preorders: StudentPreorder[]): { key: string; rows: StudentPreorder[] }[] {
    const batches: { key: string; rows: StudentPreorder[] }[] = [];

    for (const preorder of preorders) {
        const key = preorder.batch ?? `preorder-${preorder.id}`;
        const last = batches[batches.length - 1];

        if (last && last.key === key) {
            last.rows.push(preorder);
        } else {
            batches.push({ key, rows: [preorder] });
        }
    }

    return batches;
}

/** Each status's short words and V1 colors, as a small pill. */
function statusPill(preorder: StudentPreorder): { text: string; box: string; word: string } {
    switch (preorder.status) {
        case 'held':
            return {
                text: `Held until ${formatDateTime(preorder.held_until)}`,
                box: 'border-emerald-200 bg-emerald-50',
                word: 'text-emerald-700',
            };
        case 'arrived':
            return { text: 'Arrived', box: 'border-emerald-200 bg-emerald-50', word: 'text-emerald-700' };
        case 'ordered':
            return preorder.order_status === 'cancelled'
                ? { text: 'Order cancelled', box: 'border-slate-200 bg-slate-50', word: 'text-slate-500' }
                : { text: 'Ordered', box: 'border-blue-200 bg-blue-50', word: 'text-blue-700' };
        case 'cancelled':
            return { text: 'Cancelled', box: 'border-slate-200 bg-slate-50', word: 'text-slate-500' };
        case 'hold_ended':
            return { text: 'Hold ended', box: 'border-slate-200 bg-slate-50', word: 'text-slate-500' };
        case 'not_restocked':
            return { text: 'Not restocked', box: 'border-red-200 bg-red-50', word: 'text-red-700' };
        default:
            return {
                text: preorder.waiting_for_restock ? 'Waiting for restock' : 'Waiting to arrive',
                box: 'border-amber-200 bg-amber-50',
                word: 'text-amber-700',
            };
    }
}

/**
 * One card per press of Preorder, kept minimal like an online shop's order:
 * the item's photo, name and date once on top, then one line per size or
 * color with its status and buttons, and the price note once at the bottom.
 */
function PreorderBatch({
    rows,
    onChanged,
    onEdit,
}: {
    rows: StudentPreorder[];
    onChanged: (preorder: StudentPreorder) => void;
    onEdit: (preorder: StudentPreorder) => void;
}) {
    const first = rows[0];
    const waiting = rows.find((row) => row.status === 'active');

    return (
        <View className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <Pressable
                onPress={() => router.push(`/product/${first.product_id}`)}
                accessibilityRole="button"
                accessibilityLabel={`View ${first.product_name}`}
                className="flex-row items-center gap-3 px-3.5 py-3"
            >
                <View className="h-11 w-11 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                    {first.photo_url ? (
                        <Image source={{ uri: first.photo_url }} style={{ width: 44, height: 44 }} resizeMode="cover" />
                    ) : (
                        <ImageIcon size={18} color="#cbd5e1" />
                    )}
                </View>
                <View className="flex-1">
                    <Text className="font-sans-bold text-sm text-slate-900" numberOfLines={1}>
                        {first.product_name}
                    </Text>
                    <Text className="font-sans text-xs text-slate-500">
                        Preordered {formatDateTime(first.created_at)}
                    </Text>
                </View>
            </Pressable>
            {rows.map((row) => (
                <PreorderRow key={row.id} preorder={row} onChanged={onChanged} onEdit={onEdit} />
            ))}
            {waiting && (
                <Text className="border-t border-slate-100 px-3.5 py-2 font-sans text-xs text-slate-500">
                    {preorderPriceNote(waiting.preordered_price_centavos)}
                </Text>
            )}
        </View>
    );
}

/**
 * One size or color in one line: size and how many with its status, then
 * its buttons side by side, all the same size.
 */
function PreorderRow({
    preorder,
    onChanged,
    onEdit,
}: {
    preorder: StudentPreorder;
    onChanged: (preorder: StudentPreorder) => void;
    onEdit: (preorder: StudentPreorder) => void;
}) {
    const { request } = useAuth();
    const [cancelling, setCancelling] = useState(false);
    const [ordering, setOrdering] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const held = preorder.status === 'held';
    const pill = statusPill(preorder);
    const hasButtons =
        preorder.status === 'arrived' ||
        held ||
        preorder.can_edit === true ||
        preorder.can_cancel;

    const cancel = (): void => {
        // It cannot be undone, so the alert says what will happen.
        const whatHappens = held
            ? `The ${preorder.quantity === 1 ? 'piece goes' : `${preorder.quantity} pcs go`} to the next buyer in line, or back on sale. This cannot be undone.`
            : 'You lose your place in line and any early-bird price. Preordering again puts you at the end of the line. This cannot be undone.';

        Alert.alert(
            held
                ? `Give up the ${preorder.quantity === 1 ? 'piece' : 'pieces'} held for you?`
                : `Cancel your preorder for ${preorder.product_name}${preorder.variant_label ? ` (${preorder.variant_label})` : ''}?`,
            whatHappens,
            [
                { text: 'Keep it', style: 'cancel' },
                {
                    text: held ? 'Give up' : 'Cancel preorder',
                    style: 'destructive',
                    onPress: async () => {
                        setCancelling(true);
                        setError(null);

                        try {
                            const result = await request<{ preorder: StudentPreorder }>(`/preorders/${preorder.id}`, {
                                method: 'DELETE',
                            });

                            onChanged(result.preorder);
                        } catch (caught) {
                            setError(
                                caught instanceof ApiError ? caught.message : 'The preorder could not be cancelled. Try again.',
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
        <View className={`gap-2.5 border-t border-slate-100 px-3.5 py-3 ${preorder.status === 'cancelled' ? 'opacity-60' : ''}`}>
            <View className="flex-row items-center justify-between gap-2">
                <Text className="flex-1 font-sans-bold text-sm text-slate-900" numberOfLines={1}>
                    {preorder.variant_label ?? 'Standard'}
                    <Text className="font-sans-semibold text-slate-500">  ×{preorder.quantity}</Text>
                </Text>
                <View className={`rounded-full border px-2 py-0.5 ${pill.box}`}>
                    <Text className={`font-sans-bold text-[11px] ${pill.word}`}>{pill.text}</Text>
                </View>
            </View>

            {error && <Text className="font-sans-semibold text-sm text-red-600">{error}</Text>}

            {hasButtons && (
                <View className="flex-row gap-2">
                    {preorder.status === 'arrived' && (
                        <Pressable
                            onPress={() => router.push(`/product/${preorder.product_id}`)}
                            accessibilityRole="button"
                            className={`${PREORDER_BUTTON} border-emerald-600 bg-emerald-600`}
                        >
                            <Store size={14} color="#ffffff" />
                            <Text className="font-sans-bold text-sm text-white">Buy it</Text>
                        </Pressable>
                    )}
                    {held && (
                        <Pressable
                            onPress={() => setOrdering(true)}
                            accessibilityRole="button"
                            className={`${PREORDER_BUTTON} border-emerald-600 bg-emerald-600`}
                        >
                            <ShoppingBag size={14} color="#ffffff" />
                            <Text className="font-sans-bold text-sm text-white">Order now</Text>
                        </Pressable>
                    )}
                    {preorder.can_edit && (
                        <Pressable
                            onPress={() => onEdit(preorder)}
                            accessibilityRole="button"
                            className={`${PREORDER_BUTTON} border-slate-300 bg-white`}
                        >
                            <Pencil size={14} color="#334155" />
                            <Text className="font-sans-bold text-sm text-slate-700">Change</Text>
                        </Pressable>
                    )}
                    {preorder.can_cancel && (
                        <Pressable
                            onPress={cancel}
                            disabled={cancelling}
                            accessibilityRole="button"
                            className={`${PREORDER_BUTTON} border-red-200 bg-red-50 ${cancelling ? 'opacity-60' : ''}`}
                        >
                            {cancelling ? (
                                <ActivityIndicator size="small" color="#b91c1c" />
                            ) : (
                                <XCircle size={14} color="#b91c1c" />
                            )}
                            <Text className="font-sans-bold text-sm text-red-700">
                                {held ? `I do not want ${preorder.quantity === 1 ? 'it' : 'them'}` : 'Cancel'}
                            </Text>
                        </Pressable>
                    )}
                </View>
            )}

            {held && <HeldOrderSheet preorder={preorder} open={ordering} onClose={() => setOrdering(false)} />}
        </View>
    );
}

/** Every button on a preorder line: they share the width, the same height and text size. */
const PREORDER_BUTTON = 'flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border px-3 py-2';
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
