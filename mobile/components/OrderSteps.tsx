import { CalendarDays } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { formatDate } from '@/lib/format';

/**
 * What happens after Place Order, as three numbered steps (cart and the
 * "Order placed" screen): place it, show the issuance slip at the PROWARE
 * office by the pick-up date, pay there and get the items.
 */
export default function OrderSteps({ pickUpBy, placed = false }: { pickUpBy: string; placed?: boolean }) {
    return (
        <View className="gap-3">
            <Step number={1} done={placed}>
                {placed ? 'Order placed' : 'Place your order'}
            </Step>
            <Step number={2}>Show your issuance slip at the PROWARE office by</Step>
            <View className="-mt-2 ml-10 flex-row">
                <View className="flex-row items-center gap-1 rounded-lg bg-blue-50 px-2 py-1">
                    <CalendarDays size={14} color="#1d4ed8" />
                    <Text className="font-sans-bold text-sm text-blue-700">{formatDate(pickUpBy)}</Text>
                </View>
            </View>
            <Step number={3}>Pay there and get your items</Step>
            <Text className="ml-10 font-sans text-xs text-slate-500">
                Not picked up by then? The order is cancelled.
            </Text>
        </View>
    );
}

function Step({ number, done = false, children }: { number: number; done?: boolean; children: ReactNode }) {
    return (
        <View className="flex-row items-center gap-3">
            <View
                className={`h-7 w-7 items-center justify-center rounded-full border ${done ? 'border-emerald-600 bg-emerald-600' : 'border-blue-200 bg-blue-50'}`}
            >
                <Text className={`font-sans-bold text-xs ${done ? 'text-white' : 'text-blue-700'}`}>
                    {done ? '✓' : number}
                </Text>
            </View>
            <Text className="flex-1 font-sans-medium text-sm leading-5 text-slate-700">{children}</Text>
        </View>
    );
}
