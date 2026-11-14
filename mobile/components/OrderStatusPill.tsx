import { Text, View } from 'react-native';

import { formatDate } from '@/lib/format';
import type { StudentOrder } from '@/lib/types';

type OrderDates = Pick<
    StudentOrder,
    'status' | 'placed_at' | 'picked_up_at' | 'cancelled_at' | 'expired'
>;

/**
 * One line under an order (buyer's and Specialist's lists): when it was
 * placed and that whoever pays first gets the items, or how it ended.
 */
export function orderNote(order: OrderDates): { text: string; className: string } {
    if (order.status === 'placed') {
        return {
            text: `Placed ${formatDate(order.placed_at)} · first to pay, first served`,
            className: 'font-sans-bold text-amber-600',
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
 * and phone): amber is waiting for payment, green is released, red is
 * cancelled.
 */
const statusClasses: Record<StudentOrder['status'], [string, string]> = {
    placed: ['bg-amber-100', 'text-amber-700'],
    picked_up: ['bg-emerald-100', 'text-emerald-700'],
    cancelled: ['bg-red-100', 'text-red-700'],
};

/** The stripe down a card's left edge, in its status color. */
export const orderStripeColors: Record<StudentOrder['status'], string> = {
    placed: '#f59e0b',
    picked_up: '#10b981',
    cancelled: '#f87171',
};

/** V1's date colors (see dueDateTier): red overdue, amber today, blue later. */
export const dateTierClasses = {
    overdue: 'font-sans-bold text-red-600',
    today: 'font-sans-bold text-amber-600',
    later: 'font-sans-bold text-blue-700',
} as const;

/** "Waiting for payment", "Released" or "Cancelled", in color. */
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
