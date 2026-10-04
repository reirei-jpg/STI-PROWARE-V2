import { Text, View } from 'react-native';

import type { StudentOrder } from '@/lib/types';

/*
 * V1's status colors, which the user chose for the whole system (website
 * and phone): amber is waiting (placed, not paid yet), green is good news
 * (ready, picked up), red is cancelled.
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

/** "Placed", "Ready for pickup", "Picked up" or "Cancelled", in color. */
export default function OrderStatusPill({ order }: { order: StudentOrder }) {
    const [background, text] = statusClasses[order.status];

    return (
        <View className={`rounded-full px-3 py-1 ${background}`}>
            <Text className={`font-sans-bold text-xs ${text}`}>{order.status_label}</Text>
        </View>
    );
}
