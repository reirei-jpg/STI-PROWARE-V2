import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Banknote, CircleCheck, QrCode, XCircle } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BottomSheet from '@/components/BottomSheet';
import CancelReasonList from '@/components/CancelReasonList';
import LoadError from '@/components/LoadError';
import LoadingState from '@/components/LoadingState';
import OrderItemsList from '@/components/OrderItemsList';
import OrderStatusPill, { orderStripeColors } from '@/components/OrderStatusPill';
import { ApiError, loadErrorMessage } from '@/lib/api';
import { STUDENT_CANCEL_REASONS, cancelReasonReady } from '@/lib/cancel-reasons';
import { useAuth } from '@/lib/auth';
import { formatDate, formatDateTime, formatPeso } from '@/lib/format';
import type { StudentOrder } from '@/lib/types';
import { useBackFromOrder } from '@/lib/use-back-from-order';
import { useLiveReload } from '@/lib/use-live-reload';

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
    const [done, setDone] = useState<string | null>(null);

    const load = useCallback(
        () =>
            request<StudentOrder>(`/orders/${id}`)
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

    // Up to date by itself while the order is open: once the office
    // releases it, Cancel goes away without reloading.
    useLiveReload(load, order?.status === 'placed' && !cancelling);

    // Cancel opens a sheet to pick why, like in online shops.
    const [sheetOpen, setSheetOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [note, setNote] = useState('');

    const openCancel = (): void => {
        setReason('');
        setNote('');
        setError(null);
        setSheetOpen(true);
    };

    const cancel = async (current: StudentOrder): Promise<void> => {
        setCancelling(true);
        setError(null);

        try {
            const result = await request<{ message: string; order: StudentOrder }>(`/orders/${current.id}/cancel`, {
                method: 'POST',
                body: { reason, note: note.trim() },
            });

            setOrder(result.order);
            setDone(result.message);
            setSheetOpen(false);
        } catch (caught) {
            setError(caught instanceof ApiError ? caught.message : 'The order could not be cancelled. Try again.');
        } finally {
            setCancelling(false);
        }
    };

    // Released: Back goes to the store (also the phone's back button).
    const released = order?.status === 'picked_up';
    const goBack = useBackFromOrder(released);

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
                onPress={goBack}
                accessibilityRole="button"
                className="flex-row items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
                <ArrowLeft size={17} color="#334155" />
                <Text className="font-sans-bold text-sm text-slate-700">{released ? 'Back to the store' : 'Back'}</Text>
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
                            <Text className="font-sans text-xs text-slate-500">
                                Placed {formatDateTime(order.placed_at)}
                            </Text>
                        </View>
                        <OrderStatusPill order={order} />
                    </View>

                    <NextStep order={order} />

                    {done && (
                        <View className="flex-row items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                            <CircleCheck size={18} color="#047857" />
                            <Text className="flex-1 font-sans-semibold text-sm text-emerald-800">{done}</Text>
                        </View>
                    )}

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
                            onPress={openCancel}
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

                    <BottomSheet
                        open={sheetOpen}
                        onClose={() => setSheetOpen(false)}
                        title={`Cancel order ${order.number}?`}
                        subtitle={`Why are you cancelling? ${formatPeso(order.total_centavos)} · the items go back on sale`}
                        icon={<XCircle size={20} color="#b91c1c" />}
                        footer={
                            <Pressable
                                onPress={() => cancel(order)}
                                disabled={cancelling || !cancelReasonReady(reason, note)}
                                accessibilityRole="button"
                                className={`flex-row items-center justify-center gap-2 rounded-2xl bg-red-600 py-4 ${cancelling || !cancelReasonReady(reason, note) ? 'opacity-50' : ''}`}
                            >
                                {cancelling && <ActivityIndicator color="#ffffff" />}
                                <Text className="font-sans-bold text-base text-white">Cancel order</Text>
                            </Pressable>
                        }
                    >
                        <CancelReasonList
                            reasons={STUDENT_CANCEL_REASONS}
                            reason={reason}
                            note={note}
                            onReason={setReason}
                            onNote={setNote}
                            notePlaceholder="e.g. I will order together with my classmates instead."
                        />
                        {error && <Text className="font-sans-semibold text-sm text-red-600">{error}</Text>}
                    </BottomSheet>
                </>
            )}
        </ScrollView>
    );
}

function NextStep({ order }: { order: StudentOrder }) {
    if (order.status === 'placed') {
        return (
            <View
                style={{ borderLeftWidth: 5, borderLeftColor: orderStripeColors[order.status] }}
                className="flex-row items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3"
            >
                <Banknote size={20} color="#b45309" />
                <Text className="flex-1 font-sans text-sm leading-5 text-amber-900">
                    Pay <Text className="font-sans-bold">{formatPeso(order.total_centavos)}</Text> at the
                    cashier, then show the receipt and the issuance slip at the PROWARE office. Whoever pays
                    first gets the items, so pay soon.
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
                      ? `Expired: not released by ${order.pick_up_by ? formatDate(order.pick_up_by) : 'its pick-up date'}, so its items went back on sale.`
                      : `Cancelled ${formatDateTime(order.cancelled_at)}${order.cancel_reason ? ` · ${order.cancel_reason}` : ''}`}
            </Text>
        </View>
    );
}
