import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, CircleCheck } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LoadError from '@/components/LoadError';
import LoadingState from '@/components/LoadingState';
import OrderItemsList from '@/components/OrderItemsList';
import OrderStatusPill, { orderNote, orderStripeColors } from '@/components/OrderStatusPill';
import { ReleaseBox } from '@/components/StaffOrderActions';
import StaffTag from '@/components/StaffTag';
import { ApiError, loadErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLiveReload } from '@/lib/use-live-reload';
import { formatDate, formatDateTime, formatPeso } from '@/lib/format';
import type { SpecialistOrder } from '@/lib/types';

/**
 * One buyer's order on the Specialist's phone, with the website's steps:
 * Release once the buyer has paid (the items leave the shelf only then, as
 * many as are left; a release is final). Only the buyer can cancel an order.
 */
export default function StaffOrderScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const insets = useSafeAreaInsets();
    const { request } = useAuth();
    const [order, setOrder] = useState<SpecialistOrder | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(
        () =>
            request<SpecialistOrder>(`/specialist/orders/${id}`)
                .then((loaded) => {
                    setOrder(loaded);
                    setLoadError(null);
                })
                .catch((caught) =>
                    setLoadError(
                        caught instanceof ApiError && caught.status === 404
                            ? 'This order was not found.'
                            : loadErrorMessage(caught, 'The order could not be loaded.'),
                    ),
                ),
        [id, request],
    );

    useEffect(() => {
        void load();
    }, [load]);

    // Up to date by itself while the order is open: once it is released,
    // cancelled or expires elsewhere, Release and Cancel go away.
    useLiveReload(load, order?.status === 'placed' && !busy);

    const run = async (path: string, body?: Record<string, unknown>): Promise<boolean> => {
        if (!order) {
            return false;
        }

        setBusy(true);
        setError(null);
        setDone(null);

        try {
            const result = await request<{ message: string; order: SpecialistOrder }>(
                `/specialist/orders/${order.id}/${path}`,
                { method: 'POST', body },
            );

            setOrder(result.order);
            setDone(result.message);

            return true;
        } catch (caught) {
            setError(caught instanceof ApiError ? caught.message : 'It could not be done. Try again.');
            // Someone may have changed it on the website meanwhile.
            load();

            return false;
        } finally {
            setBusy(false);
        }
    };

    const isOpen = order?.status === 'placed';

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

            {loadError && order === null ? (
                <LoadError message={loadError} onRetry={load} className="" />
            ) : order === null ? (
                <LoadingState />
            ) : (
                <>
                    <View className="flex-row items-start justify-between gap-3">
                        <View className="flex-1">
                            <Text className="font-sans-bold text-2xl text-slate-900">
                                Order {order.number}
                            </Text>
                            {order.is_staff && (
                                <View className="mt-1 flex-row">
                                    <StaffTag />
                                </View>
                            )}
                            <Text className="font-sans-semibold text-base text-slate-800">
                                {order.student_name}
                                {order.student_id ? ` · ID ${order.student_id}` : ''}
                                {order.student_section ? ` · ${order.student_section}` : ''}
                            </Text>
                            <Text className="font-sans text-xs text-slate-500">
                                Placed {formatDateTime(order.placed_at)}
                                {order.handled_by ? ` · handled by ${order.handled_by}` : ''}
                            </Text>
                        </View>
                        <OrderStatusPill order={order} />
                    </View>

                    <StatusBox order={order} />

                    {done && (
                        <View className="flex-row items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                            <CircleCheck size={18} color="#047857" />
                            <Text className="flex-1 font-sans-semibold text-sm text-emerald-800">{done}</Text>
                        </View>
                    )}
                    {error && (
                        <View className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                            <Text className="font-sans-semibold text-sm text-red-700">{error}</Text>
                        </View>
                    )}

                    <View className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
                        <OrderItemsList order={order} />
                    </View>

                    <View className="gap-3">
                        {isOpen && (
                            <ReleaseBox
                                order={order}
                                busy={busy}
                                onRelease={() => void run('release', { paid: true })}
                            />
                        )}
                    </View>

                </>
            )}
        </ScrollView>
    );
}

/** What is happening with the order now, in the date and status colors. */
function StatusBox({ order }: { order: SpecialistOrder }) {
    const note = orderNote(order);
    const text =
        order.status === 'placed'
            ? `Waiting for ${order.student_name} to pay ${formatPeso(order.total_centavos)} at the cashier and show the receipt and the issuance slip.`
            : order.status === 'picked_up'
              ? `Released ${formatDateTime(order.picked_up_at)}.`
              : order.expired
                ? `Expired: not released by ${order.pick_up_by ? formatDate(order.pick_up_by) : 'its pick-up date'}.`
                : `Cancelled ${formatDateTime(order.cancelled_at)}${order.cancel_reason ? ` · ${order.cancel_reason}` : ''}`;

    return (
        <View
            style={{ borderLeftWidth: 5, borderLeftColor: orderStripeColors[order.status] }}
            className="gap-1 rounded-2xl border border-slate-200 bg-white px-4 py-3"
        >
            <Text className="font-sans text-sm leading-5 text-slate-700">{text}</Text>
            {order.status === 'placed' && (
                <Text className={`text-xs ${note.className}`}>{note.text}</Text>
            )}
        </View>
    );
}
