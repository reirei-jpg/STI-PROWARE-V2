import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import OrderStatusPill, { orderNote, orderStripeColors } from '@/components/OrderStatusPill';
import { formatPeso } from '@/lib/format';
import type { SpecialistOrder } from '@/lib/types';

/**
 * One student's order on the Specialist's lists (Orders, and the To-do's
 * order cards): number, status, student, items and total, and its date.
 * Tapping it opens the order.
 */
export default function StaffOrderRow({
    order,
    onOpen,
}: {
    order: SpecialistOrder;
    /** Runs before the order opens, e.g. to close a popup. */
    onOpen?: () => void;
}) {
    const isOpen = order.status === 'placed' || order.status === 'ready';
    const note = orderNote(order);
    const itemCount = order.items.length;

    return (
        <Pressable
            onPress={() => {
                onOpen?.();
                router.push(`/staff-order/${order.id}`);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Order ${order.number} for ${order.student_name}, ${order.status_label}`}
            style={{ borderLeftWidth: 5, borderLeftColor: orderStripeColors[order.status] }}
            className={`flex-row items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 ${isOpen ? '' : 'opacity-70'}`}
        >
            <View className="flex-1 gap-1">
                <View className="flex-row items-center justify-between gap-2">
                    <Text className="font-sans-bold text-base text-slate-900">{order.number}</Text>
                    <OrderStatusPill order={order} />
                </View>
                <Text numberOfLines={1} className="font-sans-semibold text-sm text-slate-800">
                    {order.student_name}
                </Text>
                <Text className="font-sans text-sm text-slate-600">
                    {itemCount} {itemCount === 1 ? 'item' : 'items'} ·{' '}
                    <Text className="font-sans-bold text-slate-900">{formatPeso(order.total_centavos)}</Text>
                </Text>
                <Text className={`text-xs ${note.className}`}>{note.text}</Text>
            </View>
            <ChevronRight size={18} color="#94a3b8" />
        </Pressable>
    );
}
