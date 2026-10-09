import { Text, View } from 'react-native';

import { dueDateTier, formatDate } from '@/lib/format';
import type { StudentOrder } from '@/lib/types';

type OrderDates = Pick<
    StudentOrder,
    'status' | 'pick_up_by' | 'picked_up_at' | 'cancelled_at' | 'expired'
>;

/**
 * One line under an order (student's and Specialist's lists): when to pick
 * it up, in the date colors, or how it ended.
 */
export function orderNote(order: OrderDates): { text: string; className: string } {
    if (order.status === 'placed' || order.status === 'ready') {
        const tier = dueDateTier(order.pick_up_by);
        const ready = order.status === 'ready' ? 'Ready · ' : '';
        const when =
            tier === 'overdue'
                ? `pick-up date passed (${formatDate(order.pick_up_by)})`
                : tier === 'today'
                  ? 'last day to pick up is today'
                  : `pick up by ${formatDate(order.pick_up_by)}`;
        const text = `${ready}${when}`;

        return {
            text: text.charAt(0).toUpperCase() + text.slice(1),
            className: dateTierClasses[tier],
        };
    }

    return order.status === 'picked_up'
        ? { text: `Released ${formatDate(order.picked_up_at)}`, className: 'font-sans text-slate-500' }
        : {
              text: order.expired
                  ? `Expired ${formatDate(order.cancelled_at)} (not released in time)`
                  : `Cancelled ${formatDate(order.cancelled_at)}`,
              className: 'font-sans text-slate-500',
          };
}

/*
 * V1's status colors, which the user chose for the whole system (website
 * and phone): amber is waiting (placed, not paid yet), green is good news
 * (ready, released), red is cancelled.
 */
const statusClasses: Record<StudentOrder['status'], [string, string]> = {
    placed: ['bg-amber-100', 'text-amber-700'],
    ready: ['bg-emerald-100', 'text-emerald-700'],
    picked_up: ['bg-emerald-100', 'text-emerald-700'],
    cancelled: ['bg-red-100', 'text-red-700'],
};

/** The stripe down a card's left edge, in its status color. */
export const orderStripeColors: Record<StudentOrder['status'], string> = {
    placed: '#f59e0b',
    ready: '#10b981',
    picked_up: '#10b981',
    cancelled: '#f87171',
};

/** V1's date colors (see dueDateTier): red overdue, amber today, blue later. */
export const dateTierClasses = {
    overdue: 'font-sans-bold text-red-600',
    today: 'font-sans-bold text-amber-600',
    later: 'font-sans-bold text-blue-700',
} as const;

/** "Placed", "Ready for pickup", "Released" or "Cancelled", in color. */
export default function OrderStatusPill({
    order,
}: {
    order: Pick<StudentOrder, 'status' | 'status_label'>;
}) {
    const [background, text] = statusClasses[order.status];

    return (
        <View className={`rounded-full px-3 py-1 ${background}`}>
            <Text className={`font-sans-bold text-xs ${text}`}>{order.status_label}</Text>
        </View>
    );
}
