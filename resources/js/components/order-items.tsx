import { formatPeso } from '@/lib/format';
import { formatUnits } from '@/lib/units';
import { cn } from '@/lib/utils';
import type { OrderRow, OrderStatus } from '@/types';

/**
 * V1's status colors, which the user chose for the whole system: amber is
 * waiting (placed, not paid yet), green is good news (ready, picked up),
 * red is cancelled.
 */
const statusClasses: Record<OrderStatus, string> = {
    placed: 'bg-amber-100 text-amber-700',
    ready: 'bg-emerald-100 text-emerald-700',
    picked_up: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-red-100 text-red-700',
};

export function OrderStatusBadge({ order }: { order: OrderRow }) {
    return (
        <span
            className={cn(
                'inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-black',
                statusClasses[order.status],
            )}
        >
            {order.status_label}
        </span>
    );
}

/**
 * An order's items, each with its unit and the price when it was ordered
 * ("2 Packs of 50 (100 pcs) × ₱900.00"), and the total.
 */
export default function OrderItems({ order }: { order: OrderRow }) {
    return (
        <div className="px-5 py-3">
            <ul className="divide-y divide-slate-100 text-sm">
                {order.items.map((item) => (
                    <li
                        key={item.id}
                        className="flex items-start justify-between gap-4 py-2"
                    >
                        <div>
                            <p className="font-bold text-slate-900">
                                {item.product_name}
                                {item.variant_label && (
                                    <span className="font-normal text-slate-500">
                                        {' '}
                                        · {item.variant_label}
                                    </span>
                                )}
                            </p>
                            <p className="text-xs text-slate-500">
                                {item.pieces_per_unit > 1
                                    ? `${formatUnits(item.quantity, item.unit_name)} of ${item.pieces_per_unit} (${formatUnits(item.quantity * item.pieces_per_unit, 'Piece')})`
                                    : formatUnits(item.quantity, 'Piece')}{' '}
                                × {formatPeso(item.unit_price_centavos)}
                            </p>
                        </div>
                        <p className="shrink-0 font-black text-slate-900">
                            {formatPeso(item.line_total_centavos)}
                        </p>
                    </li>
                ))}
            </ul>
            <p className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-sm">
                <span className="font-bold text-slate-600">Total</span>
                <span className="text-base font-black text-slate-900">
                    {formatPeso(order.total_centavos)}
                </span>
            </p>
        </div>
    );
}
