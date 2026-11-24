import { formatUnits } from '@/lib/units';
import { cn } from '@/lib/utils';
import type { ReorderView } from '@/types';

const styles: Record<ReorderView['status'], string> = {
    out_of_stock: 'bg-red-100 text-red-700',
    reorder: 'bg-amber-100 text-amber-800',
    on_order: 'bg-blue-100 text-blue-700',
    ok: 'bg-emerald-100 text-emerald-700',
};

/** A size or color's reorder status, in V1's colors: Out of stock, Reorder now, On order, OK. */
export default function ReorderBadge({ reorder }: { reorder: ReorderView }) {
    return (
        <span
            title={reorder.formula}
            className={cn(
                'inline-flex rounded-full px-2.5 py-1 text-xs font-black whitespace-nowrap',
                styles[reorder.status],
            )}
        >
            {reorder.status_label}
        </span>
    );
}

/**
 * "Reorder Point 19 pcs · order 34 pcs · 20 pcs on order": the numbers
 * behind the badge, in one short line.
 */
export function reorderLine(reorder: ReorderView): string {
    return [
        `Reorder Point ${formatUnits(reorder.reorder_point, 'Piece')}`,
        reorder.suggested > 0
            ? `order ${formatUnits(reorder.suggested, 'Piece')}`
            : null,
        reorder.on_order > 0
            ? `${formatUnits(reorder.on_order, 'Piece')} on order`
            : null,
    ]
        .filter(Boolean)
        .join(' · ');
}
