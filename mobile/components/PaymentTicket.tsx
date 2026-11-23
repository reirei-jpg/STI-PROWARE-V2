import { Text, View } from 'react-native';

import StaffTag from '@/components/StaffTag';
import { formatDate, formatPeso } from '@/lib/format';
import type { IssuanceSlipData } from '@/lib/types';

/**
 * A small order ticket for the cashier, like a fast-food counter slip (the
 * website's PaymentTicket): the slip number, the buyer, each item with its
 * amount, and the total. The full issuance slip is not needed to take a
 * payment, so the cashier reads only what is being paid for.
 */
export default function PaymentTicket({
    kind,
    number,
    date,
    buyerName,
    buyerId,
    section,
    isStaff,
    items,
    totalCentavos,
    amountDueCentavos,
    paid,
}: {
    kind: 'order' | 'preorder';
    number: string | null;
    date: string | null;
    buyerName: string;
    buyerId: string | null;
    section: string | null;
    isStaff: boolean;
    items: IssuanceSlipData['items'];
    totalCentavos: number;
    /** What is collected now; less than the total when some items are no longer left. */
    amountDueCentavos: number | null;
    paid: boolean;
}) {
    const notCharged = amountDueCentavos !== null && amountDueCentavos < totalCentavos ? totalCentavos - amountDueCentavos : 0;
    const details = [buyerId, section].filter(Boolean).join(' · ') || '—';

    return (
        <View className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <View className="border-b border-dashed border-slate-300 px-4 pb-3 pt-4">
                <Text className="font-sans-bold text-xs uppercase tracking-[3px] text-slate-500">
                    {kind === 'order' ? 'Order' : 'Preorder slip'}
                </Text>
                <Text className="font-sans-bold text-2xl text-red-700">{number}</Text>
                <View className="mt-1.5 flex-row items-center gap-2">
                    <Text className="shrink font-sans-bold text-base text-slate-900">{buyerName}</Text>
                    {isStaff && <StaffTag />}
                </View>
                <Text className="font-sans text-sm text-slate-500">
                    {details}
                    {date ? ` · ${formatDate(date)}` : ''}
                </Text>
            </View>

            {paid && (
                <View
                    style={{ transform: [{ rotate: '-12deg' }], borderWidth: 3, borderStyle: 'solid', borderColor: '#059669', borderRadius: 8 }}
                    className="absolute right-4 top-4 px-2.5 py-0.5"
                >
                    <Text className="font-sans-bold text-lg tracking-[3px] text-emerald-700">PAID</Text>
                </View>
            )}

            {items.length === 0 && <Text className="px-4 py-3 font-sans text-sm text-slate-500">No items to pay for.</Text>}
            {items.map((line, index) => (
                <View
                    key={`${line.item}-${index}`}
                    className={`flex-row items-start justify-between gap-3 px-4 py-2.5 ${index > 0 ? 'border-t border-dashed border-slate-200' : ''}`}
                >
                    <View className="flex-1">
                        <Text className="font-sans-bold text-sm text-slate-900">
                            {line.quantity} × {line.item}
                        </Text>
                        {line.quantity > 1 && (
                            <Text className="font-sans text-xs text-slate-500">{formatPeso(line.unit_price_centavos)} each</Text>
                        )}
                    </View>
                    <Text className="font-sans-bold text-sm text-slate-900">{formatPeso(line.amount_centavos)}</Text>
                </View>
            ))}

            <View className="gap-1 border-t border-dashed border-slate-300 px-4 py-3">
                {notCharged > 0 && (
                    <>
                        <View className="flex-row justify-between">
                            <Text className="font-sans text-sm text-slate-600">Subtotal</Text>
                            <Text className="font-sans text-sm text-slate-600">{formatPeso(totalCentavos)}</Text>
                        </View>
                        <View className="flex-row justify-between">
                            <Text className="font-sans-semibold text-sm text-amber-800">Not left, not charged</Text>
                            <Text className="font-sans-semibold text-sm text-amber-800">−{formatPeso(notCharged)}</Text>
                        </View>
                    </>
                )}
                <View className="flex-row items-baseline justify-between">
                    <Text className="font-sans-bold text-sm uppercase tracking-wide text-slate-700">Total</Text>
                    <Text className="font-sans-bold text-2xl text-slate-950">{formatPeso(totalCentavos - notCharged)}</Text>
                </View>
            </View>
        </View>
    );
}
