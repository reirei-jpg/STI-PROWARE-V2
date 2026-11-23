import { ChevronRight, Unlink } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { formatDate, formatDateTime, formatUnits } from '@/lib/format';
import type { RecordedDelivery } from '@/lib/types';

/**
 * One recorded delivery from Head Office (the Specialist's and the School
 * Admin's Stock In): when it arrived, its SI # and DR #, the eStore orders
 * it was for, what went into stock, and who recorded it. With onPress it
 * opens the order it was for.
 */
export default function DeliveryRow({ delivery, onPress }: { delivery: RecordedDelivery; onPress?: () => void }) {
    const numbers = [
        delivery.sales_invoice_number ? `SI ${delivery.sales_invoice_number}` : null,
        delivery.delivery_receipt_number ? `DR ${delivery.delivery_receipt_number}` : null,
    ].filter(Boolean);

    return (
        <Pressable
            onPress={onPress}
            disabled={onPress === undefined}
            accessibilityRole={onPress ? 'button' : undefined}
            style={{
                borderLeftWidth: 5,
                borderLeftColor: delivery.items_not_in_stock > 0 ? '#f59e0b' : '#10b981',
            }}
            className="gap-1 rounded-2xl border border-slate-200 bg-white px-4 py-3"
        >
            <View className="flex-row items-center justify-between gap-2">
                <Text className="font-sans-bold text-base text-slate-900">Received {formatDate(delivery.received_on)}</Text>
                {onPress && <ChevronRight size={18} color="#94a3b8" />}
            </View>
            <Text className="font-sans-semibold text-xs text-slate-500">{numbers.length > 0 ? numbers.join(' · ') : 'No SI # or DR #'}</Text>
            {delivery.order_numbers.length > 0 && (
                <Text className="font-sans text-sm text-slate-700">Order #{delivery.order_numbers.join(', #')}</Text>
            )}
            <Text className="font-sans-bold text-sm text-emerald-700">{formatUnits(delivery.pieces_added_to_stock, 'Piece')} added to stock</Text>
            {delivery.items_not_in_stock > 0 && (
                <View className="flex-row items-center gap-1.5">
                    <Unlink size={13} color="#b45309" />
                    <Text className="flex-1 font-sans-semibold text-xs text-amber-700">
                        {delivery.items_not_in_stock === 1
                            ? '1 item not linked to a product, so not in stock yet'
                            : `${delivery.items_not_in_stock} items not linked to a product, so not in stock yet`}
                    </Text>
                </View>
            )}
            <Text className="font-sans text-[11px] text-slate-400">
                Recorded by {delivery.recorded_by} · {formatDateTime(delivery.recorded_at)}
            </Text>
        </Pressable>
    );
}
