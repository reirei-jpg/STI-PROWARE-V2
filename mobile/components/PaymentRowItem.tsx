import { router } from 'expo-router';
import { Banknote, Smartphone, Undo2 } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { formatDateTime, formatPeso } from '@/lib/format';
import type { PaymentRow } from '@/lib/types';

/**
 * One payment in the cashier's lists (Dashboard, Payment History): the
 * receipt number, slip, buyer, method, time and amount; a void one crossed
 * out with its reason. Tapping it opens the Payment Receipt.
 */
export default function PaymentRowItem({ row, first = false }: { row: PaymentRow; first?: boolean }) {
    const Icon = row.void ? Undo2 : row.method === 'cash' ? Banknote : Smartphone;

    return (
        <Pressable
            onPress={() => router.push({ pathname: '/cashier-receipt/[id]', params: { id: String(row.id) } })}
            accessibilityRole="button"
            accessibilityLabel={`Payment Receipt ${row.receipt_number ?? ''}`}
            className={`flex-row items-center gap-3 px-4 py-3 ${first ? '' : 'border-t border-slate-100'} ${row.void ? 'bg-red-50/50' : ''}`}
        >
            <View className={`h-9 w-9 items-center justify-center rounded-xl ${row.void ? 'bg-red-50' : 'bg-blue-50'}`}>
                <Icon size={17} color={row.void ? '#b91c1c' : '#1d4ed8'} />
            </View>
            <View className="flex-1">
                <Text className="font-sans-bold text-sm text-slate-900">
                    {row.receipt_number}
                    {row.void ? <Text className="text-red-700"> · VOID</Text> : null}
                </Text>
                <Text className="font-sans text-xs text-slate-500">
                    {row.number} · {row.buyer_name} · {row.method_label}
                </Text>
                <Text className="font-sans text-xs text-slate-400">{formatDateTime(row.paid_at)}</Text>
                {row.void && row.void_reason ? <Text className="font-sans text-xs text-red-700">{row.void_reason}</Text> : null}
            </View>
            <Text className={`font-sans-bold text-sm ${row.void ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                {formatPeso(row.amount_centavos)}
            </Text>
        </Pressable>
    );
}
