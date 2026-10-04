import { Text, View } from 'react-native';

import { formatPeso, formatUnits } from '@/lib/format';
import type { StudentOrder } from '@/lib/types';

/**
 * An order's items, each with its unit and the price when it was ordered
 * ("2 Packs (100 pcs) × ₱900.00"), and the total to pay in cash.
 */
export default function OrderItemsList({ order }: { order: StudentOrder }) {
    return (
        <View>
            {order.items.map((item, position) => (
                <View
                    key={item.id}
                    className={`flex-row items-start gap-3 px-4 py-3 ${position === 0 ? '' : 'border-t border-slate-100'}`}
                >
                    <View className="flex-1">
                        <Text className="font-sans-bold text-sm text-slate-900">
                            {item.product_name}
                            {item.variant_label && (
                                <Text className="font-sans text-slate-500">
                                    {' '}
                                    · {item.variant_label}
                                </Text>
                            )}
                        </Text>
                        <Text className="font-sans text-xs text-slate-500">
                            {formatUnits(item.quantity, item.unit_name)}
                            {item.pieces_per_unit > 1
                                ? ` (${formatUnits(item.quantity * item.pieces_per_unit, 'Piece')})`
                                : ''}{' '}
                            × {formatPeso(item.unit_price_centavos)}
                        </Text>
                    </View>
                    <Text className="font-sans-bold text-sm text-slate-900">
                        {formatPeso(item.line_total_centavos)}
                    </Text>
                </View>
            ))}
            <View className="flex-row items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3">
                <Text className="font-sans-bold text-sm text-slate-600">
                    Total to pay in cash
                </Text>
                <Text className="font-sans-bold text-lg text-slate-900">
                    {formatPeso(order.total_centavos)}
                </Text>
            </View>
        </View>
    );
}
