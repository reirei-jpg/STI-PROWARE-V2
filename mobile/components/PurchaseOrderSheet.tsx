import { BellRing, ClipboardList } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import BottomSheet from '@/components/BottomSheet';
import LoadError from '@/components/LoadError';
import { ApiError, loadErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatDateTime, formatPeso } from '@/lib/format';
import type { AdminDeliveryTab, PurchaseOrderDetails } from '@/lib/types';

/** The School Admin's eStore order tabs, in the website's words. */
export const DELIVERY_TABS: { value: AdminDeliveryTab; label: string; hint: string; tone: 'amber' | 'blue' | 'green' }[] = [
    { value: 'coming', label: 'Awaiting Delivery', hint: 'Uploaded by the Specialist; nothing has arrived yet', tone: 'amber' },
    { value: 'ongoing', label: 'Partially Received', hint: 'Some items have arrived; the rest are still coming', tone: 'blue' },
    { value: 'completed', label: 'Completed', hint: 'Everything arrived, or the Specialist closed it with some items missing', tone: 'green' },
];

/** Badge colors by delivery status, as on the website. */
export const statusTone: Record<PurchaseOrderDetails['delivery_status'], { box: string; text: string; bar: string }> = {
    awaiting: { box: 'bg-amber-100', text: 'text-amber-800', bar: '#f59e0b' },
    partially_received: { box: 'bg-blue-100', text: 'text-blue-800', bar: '#0D6EFD' },
    completed: { box: 'bg-emerald-100', text: 'text-emerald-800', bar: '#10b981' },
    completed_short: { box: 'bg-red-100', text: 'text-red-800', bar: '#ef4444' },
};

/**
 * One eStore order for the School Admin (view only, like the website's View
 * Details): what has arrived, each item ordered, and the Delivery History.
 * A late order has Remind Specialist (once a week), which asks first.
 */
export default function PurchaseOrderSheet({
    purchaseOrderId,
    onClose,
    onChanged,
}: {
    purchaseOrderId: number | null;
    onClose: () => void;
    /** The list behind it shows the reminder too. */
    onChanged?: () => void;
}) {
    const { request, user } = useAuth();
    const [order, setOrder] = useState<PurchaseOrderDetails | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [sending, setSending] = useState(false);

    const load = useCallback(async (): Promise<void> => {
        if (purchaseOrderId === null) {
            return;
        }

        setError(null);

        try {
            setOrder(await request<PurchaseOrderDetails>(`/admin/purchase-orders/${purchaseOrderId}`));
        } catch (caught) {
            setError(
                caught instanceof ApiError && caught.status === 404
                    ? 'This eStore order was not found.'
                    : loadErrorMessage(caught, 'The order could not be loaded.'),
            );
        }
    }, [purchaseOrderId, request]);

    useEffect(() => {
        setOrder(null);
        void load();
    }, [load]);

    const label = order?.order_number ? `Order #${order.order_number}` : 'this order';

    const remind = (): void => {
        if (!order) {
            return;
        }

        Alert.alert(
            `Remind the Specialist about ${label}?`,
            `It is not complete after ${order.late_days} days: ${(order.quantity_ordered_total - order.quantity_received_total).toLocaleString('en-PH')} of ${order.quantity_ordered_total.toLocaleString('en-PH')} still to come. The Specialist is notified to ask Head Office. You can remind again after a week.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remind',
                    onPress: async () => {
                        setSending(true);

                        try {
                            const result = await request<{ message: string }>(`/admin/purchase-orders/${order.id}/remind-specialist`, { method: 'POST' });
                            Alert.alert('Reminder sent', result.message);
                            await load();
                            onChanged?.();
                        } catch (caught) {
                            Alert.alert('Not sent', caught instanceof ApiError ? caught.message : 'The reminder could not be sent. Try again.');
                        } finally {
                            setSending(false);
                        }
                    },
                },
            ],
        );
    };

    const tone = order ? statusTone[order.delivery_status] : null;

    return (
        <BottomSheet
            open={purchaseOrderId !== null}
            onClose={onClose}
            title={order ? (order.order_number ? `Order #${order.order_number}` : 'eStore order') : 'eStore order'}
            subtitle={order ? `Ordered ${formatDate(order.date_ordered)}${order.category ? ` · ${order.category}` : ''}` : error ? 'Could not load' : 'Loading…'}
            icon={<ClipboardList size={20} color="#1d4ed8" />}
            footer={
                order?.can_remind ? (
                    <Pressable
                        onPress={remind}
                        disabled={sending}
                        accessibilityRole="button"
                        className={`flex-row items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 py-3.5 ${sending ? 'opacity-60' : ''}`}
                    >
                        {sending ? <ActivityIndicator color="#b91c1c" /> : <BellRing size={18} color="#b91c1c" />}
                        <Text className="font-sans-bold text-base text-red-700">Remind Specialist</Text>
                    </Pressable>
                ) : (
                    <Pressable onPress={onClose} accessibilityRole="button" className="items-center rounded-2xl border border-slate-200 bg-white py-3.5">
                        <Text className="font-sans-bold text-base text-slate-700">Close</Text>
                    </Pressable>
                )
            }
        >
            {error ? (
                <LoadError message={error} onRetry={load} className="" />
            ) : order === null || tone === null ? (
                <View className="items-center gap-2 py-8">
                    <ActivityIndicator color="#0D6EFD" />
                    <Text className="font-sans text-sm text-slate-500">Loading the order…</Text>
                </View>
            ) : (
                <>
                    <View className="gap-2">
                        <View className="flex-row flex-wrap items-center gap-2">
                            <Text className={`rounded-full px-3 py-1 font-sans-bold text-xs ${tone.box} ${tone.text}`}>{order.delivery_status_label}</Text>
                            {order.is_late && (
                                <Text className="font-sans-bold text-xs text-red-700">Late: not complete after {order.late_days} days</Text>
                            )}
                        </View>
                        <View className="h-2 overflow-hidden rounded-full bg-slate-200">
                            <View style={{ width: `${order.percent_received}%`, backgroundColor: tone.bar }} className="h-full rounded-full" />
                        </View>
                        <Text className="font-sans text-sm text-slate-600">
                            {order.percent_received}% · {order.quantity_received_total.toLocaleString('en-PH')} of{' '}
                            {order.quantity_ordered_total.toLocaleString('en-PH')} pcs received
                        </Text>
                        <Fact label="Total amount (ordered)" value={formatPeso(order.total_amount_centavos ?? 0)} />
                        {order.ordered_by && <Fact label="Ordered by" value={order.ordered_by} />}
                        <Fact label="Uploaded by" value={`${order.uploaded_by}${order.uploaded_at ? ` · ${formatDateTime(order.uploaded_at)}` : ''}`} />
                        {order.completed_at && (
                            <Fact
                                label="Completed"
                                value={`${formatDateTime(order.completed_at)}${order.completed_after_days !== null ? ` (${order.completed_after_days === 0 ? 'the same day' : `${order.completed_after_days} ${order.completed_after_days === 1 ? 'day' : 'days'}`})` : ''}`}
                            />
                        )}
                        {order.closed_reason && (
                            <Text className="rounded-xl bg-red-50 px-3 py-2 font-sans text-sm text-red-800">
                                Closed with some items missing{order.closed_by ? ` by ${order.closed_by}` : ''}: &quot;{order.closed_reason}&quot;
                            </Text>
                        )}
                        {order.reminded_at && (
                            <Text className="font-sans text-xs text-slate-500">
                                {order.reminded_by === user?.name ? 'You reminded' : `${order.reminded_by ?? 'A School Admin'} reminded`} the Specialist on{' '}
                                {formatDateTime(order.reminded_at)}.
                                {order.remind_again_on ? ` You can remind again on ${formatDate(order.remind_again_on)}.` : ''}
                            </Text>
                        )}
                    </View>

                    <View className="gap-2">
                        <Text className="font-sans-bold text-sm text-slate-900">Items ({order.items.length})</Text>
                        <View className="overflow-hidden rounded-2xl border border-slate-200">
                            {order.items.map((item, index) => (
                                <View key={`${item.item_code}-${index}`} className={`gap-0.5 px-4 py-3 ${index > 0 ? 'border-t border-slate-100' : ''}`}>
                                    <Text className="font-sans-bold text-sm text-slate-900">
                                        <Text className="text-blue-700">{item.item_code}</Text> · {item.description}
                                    </Text>
                                    <Text className="font-sans text-xs text-slate-500">
                                        {item.quantity_received.toLocaleString('en-PH')} of {item.quantity_ordered.toLocaleString('en-PH')} received
                                        {item.quantity_remaining > 0 ? ` · ${item.quantity_remaining.toLocaleString('en-PH')} still to come` : ''}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    <View className="gap-2">
                        <Text className="font-sans-bold text-sm text-slate-900">Delivery History ({order.deliveries.length})</Text>
                        {order.deliveries.length === 0 ? (
                            <Text className="rounded-2xl border border-slate-200 px-4 py-5 text-center font-sans text-sm text-slate-500">
                                Nothing has arrived yet.
                            </Text>
                        ) : (
                            <View className="overflow-hidden rounded-2xl border border-slate-200">
                                {order.deliveries.map((delivery, index) => (
                                    <View key={delivery.id} className={`gap-0.5 px-4 py-3 ${index > 0 ? 'border-t border-slate-100' : ''}`}>
                                        <Text className="font-sans-bold text-sm text-slate-900">Received {formatDate(delivery.received_on)}</Text>
                                        <Text className="font-sans text-xs text-slate-500">
                                            {delivery.sales_invoice_number || delivery.delivery_receipt_number
                                                ? [
                                                      delivery.sales_invoice_number ? `SI ${delivery.sales_invoice_number}` : null,
                                                      delivery.delivery_receipt_number ? `DR ${delivery.delivery_receipt_number}` : null,
                                                  ]
                                                      .filter(Boolean)
                                                      .join(' · ')
                                                : 'No SI # or DR #'}
                                        </Text>
                                        {delivery.items.map((item) => (
                                            <Text key={item.item_code} className="font-sans text-xs text-slate-700">
                                                {item.quantity_received.toLocaleString('en-PH')} × {item.item_code} · {item.description}
                                            </Text>
                                        ))}
                                        <Text className="font-sans text-[11px] text-slate-400">
                                            Recorded by {delivery.recorded_by}
                                            {delivery.recorded_at ? ` · ${formatDateTime(delivery.recorded_at)}` : ''}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                </>
            )}
        </BottomSheet>
    );
}

function Fact({ label, value }: { label: string; value: string }) {
    return (
        <View className="flex-row gap-2">
            <Text className="w-40 font-sans-bold text-xs text-slate-500">{label}</Text>
            <Text className="flex-1 font-sans text-sm text-slate-900">{value}</Text>
        </View>
    );
}
