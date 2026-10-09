import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, CircleCheck, PackageCheck, Undo2, XCircle } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import OrderItemsList from '@/components/OrderItemsList';
import OrderStatusPill, { orderNote, orderStripeColors } from '@/components/OrderStatusPill';
import { ActionButton, CancelSheet, ReleaseBox } from '@/components/StaffOrderActions';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatDateTime, formatPeso } from '@/lib/format';
import type { SpecialistOrder } from '@/lib/types';

/**
 * One student's order on the Specialist's phone, with the website's steps:
 * Ready for pickup (the student is told), Release once the student has
 * paid (the items leave the shelf only then), undo a release the same day,
 * and Cancel with the reason the student will see.
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
    const [cancelling, setCancelling] = useState(false);

    const load = useCallback(() => {
        request<SpecialistOrder>(`/specialist/orders/${id}`)
            .then(setOrder)
            .catch((caught) =>
                setLoadError(
                    caught instanceof ApiError && caught.status === 404
                        ? 'This order was not found.'
                        : 'The order could not be loaded. Go back and try again.',
                ),
            );
    }, [id, request]);

    useEffect(load, [load]);

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
            setError(caught instanceof ApiError ? caught.message : 'It could not be done. Please try again.');
            // Someone may have changed it on the website meanwhile.
            load();

            return false;
        } finally {
            setBusy(false);
        }
    };

    const isOpen = order?.status === 'placed' || order?.status === 'ready';

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
                            <Text className="font-sans-semibold text-base text-slate-800">
                                {order.student_name}
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
                        {order.status === 'placed' && (
                            <ActionButton
                                tone="blue"
                                icon={<PackageCheck size={18} color="#ffffff" />}
                                busy={busy}
                                onPress={() => void run('ready')}
                            >
                                Ready for pickup
                            </ActionButton>
                        )}
                        {isOpen && (
                            <ReleaseBox
                                order={order}
                                busy={busy}
                                onRelease={() => void run('release', { paid: true })}
                            />
                        )}
                        {order.can_undo_release && (
                            <ActionButton
                                small
                                tone="plain"
                                icon={<Undo2 size={16} color="#334155" />}
                                busy={busy}
                                onPress={() => void run('undo-release')}
                            >
                                Undo release
                            </ActionButton>
                        )}
                        {isOpen && (
                            <ActionButton
                                small
                                tone="red"
                                icon={<XCircle size={16} color="#b91c1c" />}
                                busy={busy}
                                onPress={() => setCancelling(true)}
                            >
                                Cancel order
                            </ActionButton>
                        )}
                    </View>

                    <CancelSheet
                        order={order}
                        open={cancelling}
                        onClose={() => setCancelling(false)}
                        onCancel={async (reason) => {
                            if (await run('cancel', { reason })) {
                                setCancelling(false);
                            }
                        }}
                        busy={busy}
                        error={error}
                    />
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
            ? 'New order: prepare it, then mark it Ready for pickup. The student is told.'
            : order.status === 'ready'
              ? `Waiting for ${order.student_name} to show the issuance slip and pay ${formatPeso(order.total_centavos)}.`
              : order.status === 'picked_up'
                ? `Released ${formatDateTime(order.picked_up_at)}.`
                : order.expired
                  ? `Expired: not released by ${formatDate(order.pick_up_by)}.`
                  : `Cancelled ${formatDateTime(order.cancelled_at)}${order.cancel_reason ? ` · ${order.cancel_reason}` : ''}`;

    return (
        <View
            style={{ borderLeftWidth: 5, borderLeftColor: orderStripeColors[order.status] }}
            className="gap-1 rounded-2xl border border-slate-200 bg-white px-4 py-3"
        >
            <Text className="font-sans text-sm leading-5 text-slate-700">{text}</Text>
            {(order.status === 'placed' || order.status === 'ready') && (
                <Text className={`text-xs ${note.className}`}>{note.text}</Text>
            )}
        </View>
    );
}
