import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Banknote, QrCode } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import OrderItemsList from '@/components/OrderItemsList';
import OrderStatusPill, {
    dateTierClasses,
    orderStripeColors,
} from '@/components/OrderStatusPill';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { dueDateTier, formatDate, formatDateTime, formatPeso } from '@/lib/format';
import type { StudentOrder } from '@/lib/types';

/**
 * One order, opened from My Orders: what to do next, its issuance slip to
 * show at the PROWARE office, the items at the price they were ordered at,
 * the total, and Cancel while it is Placed.
 */
export default function OrderScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const insets = useSafeAreaInsets();
    const { request } = useAuth();
    const [order, setOrder] = useState<StudentOrder | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [cancelling, setCancelling] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        request<StudentOrder>(`/orders/${id}`)
            .then(setOrder)
            .catch((caught) =>
                setLoadError(
                    caught instanceof ApiError && caught.status === 404
                        ? 'This order was not found.'
                        : 'The order could not be loaded. Go back and try again.',
                ),
            );
    }, [id, request]);

    const cancel = (current: StudentOrder): void => {
        Alert.alert(`Cancel order ${current.number}?`, 'The items go back to the store.', [
            { text: 'Keep it', style: 'cancel' },
            {
                text: 'Cancel order',
                style: 'destructive',
                onPress: async () => {
                    setCancelling(true);
                    setError(null);

                    try {
                        const result = await request<{ order: StudentOrder }>(
                            `/orders/${current.id}/cancel`,
                            { method: 'POST' },
                        );

                        setOrder(result.order);
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
        ]);
    };

    return (
        <ScrollView
            className="flex-1 bg-page"
            contentContainerStyle={{
                paddingTop: insets.top + 12,
                paddingBottom: insets.bottom + 32,
                paddingHorizontal: 16,
                gap: 16,
            }}
        >
            <Pressable
                onPress={() => router.back()}
                accessibilityRole="button"
                className="flex-row items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
                <ArrowLeft size={17} color="#334155" />
                <Text className="font-sans-bold text-sm text-slate-700">Back</Text>
            </Pressable>

            {loadError ? (
                <Text className="font-sans-semibold text-sm text-red-600">{loadError}</Text>
            ) : order === null ? (
                <ActivityIndicator color="#0D6EFD" className="mt-10" />
            ) : (
                <>
                    <View className="flex-row items-start justify-between gap-3">
                        <View className="flex-1">
                            <Text className="font-sans-bold text-2xl text-slate-900">
                                Order {order.number}
                            </Text>
                            <Text className="font-sans text-xs text-slate-500">
                                Placed {formatDateTime(order.placed_at)}
                            </Text>
                        </View>
                        <OrderStatusPill order={order} />
                    </View>

                    <NextStep order={order} />

                    {order.status !== 'cancelled' && (
                        <Pressable
                            onPress={() => router.push(`/slip/${order.id}`)}
                            accessibilityRole="button"
                            className="flex-row items-center justify-center gap-2 rounded-2xl bg-brand py-4"
                        >
                            <QrCode size={19} color="#ffffff" />
                            <Text className="font-sans-bold text-base text-white">
                                Show issuance slip
                            </Text>
                        </Pressable>
                    )}

                    <View className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
                        <OrderItemsList order={order} />
                    </View>

                    {error && (
                        <Text className="font-sans-semibold text-sm text-red-600">{error}</Text>
                    )}

                    {order.can_cancel && (
                        <Pressable
                            onPress={() => cancel(order)}
                            disabled={cancelling}
                            accessibilityRole="button"
                            className={`flex-row items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 py-3.5 ${cancelling ? 'opacity-60' : ''}`}
                        >
                            {cancelling && <ActivityIndicator size="small" color="#b91c1c" />}
                            <Text className="font-sans-bold text-base text-red-700">
                                Cancel order
                            </Text>
                        </Pressable>
                    )}
                </>
            )}
        </ScrollView>
    );
}

function NextStep({ order }: { order: StudentOrder }) {
    if (order.status === 'placed' || order.status === 'ready') {
        const ready = order.status === 'ready';
        const tier = dueDateTier(order.pick_up_by);

        return (
            <View
                style={{ borderLeftWidth: 5, borderLeftColor: orderStripeColors[order.status] }}
                className={`flex-row items-start gap-3 rounded-2xl border px-4 py-3 ${ready ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}
            >
                <Banknote size={20} color={ready ? '#047857' : '#b45309'} />
                <Text
                    className={`flex-1 font-sans text-sm leading-5 ${ready ? 'text-emerald-900' : 'text-amber-900'}`}
                >
                    {ready
                        ? 'Ready at the PROWARE office. '
                        : 'The PROWARE office is preparing it. '}
                    Show its issuance slip there by{' '}
                    <Text className={dateTierClasses[tier]}>
                        {tier === 'today' ? 'today' : formatDate(order.pick_up_by)}
                    </Text>{' '}
                    and pay <Text className="font-sans-bold">{formatPeso(order.total_centavos)}</Text>.
                </Text>
            </View>
        );
    }

    return (
        <View
            style={{ borderLeftWidth: 5, borderLeftColor: orderStripeColors[order.status] }}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
        >
            <Text className="font-sans text-sm text-slate-600">
                {order.status === 'picked_up'
                    ? `Released ${formatDateTime(order.picked_up_at)}.`
                    : order.expired
                      ? `Expired: not released by ${formatDate(order.pick_up_by)}, so its items went back on sale.`
                      : `Cancelled ${formatDateTime(order.cancelled_at)}${order.cancel_reason ? ` · ${order.cancel_reason}` : ''}`}
            </Text>
        </View>
    );
}
