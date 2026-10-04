import { Text, View } from 'react-native';

import type { StudentOrder } from '@/lib/types';

const statusClasses: Record<StudentOrder['status'], [string, string]> = {
    placed: ['bg-blue-100', 'text-blue-800'],
    ready: ['bg-emerald-100', 'text-emerald-800'],
    picked_up: ['bg-slate-100', 'text-slate-700'],
    cancelled: ['bg-red-100', 'text-red-700'],
};

/** "Placed", "Ready for pickup", "Picked up" or "Cancelled", in color. */
export default function OrderStatusPill({ order }: { order: StudentOrder }) {
    const [background, text] = statusClasses[order.status];

    return (
        <View className={`rounded-full px-3 py-1 ${background}`}>
            <Text className={`font-sans-bold text-xs ${text}`}>{order.status_label}</Text>
        </View>
    );
}
