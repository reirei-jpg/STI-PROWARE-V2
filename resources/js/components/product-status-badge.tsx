import { cn } from '@/lib/utils';
import type { ProductStatus } from '@/types';

/** In the store with no pieces left: shown as Out of stock (red), not Available. */
export type ShownStatus = ProductStatus | 'out_of_stock';

const styles: Record<ShownStatus, string> = {
    draft: 'bg-slate-100 text-slate-700',
    preorder: 'bg-amber-100 text-amber-800',
    available: 'bg-emerald-100 text-emerald-700',
    on_sale: 'bg-red-100 text-red-700',
    out_of_stock: 'bg-red-100 text-red-700',
};

export default function ProductStatusBadge({
    status,
    label,
}: {
    status: ShownStatus;
    label: string;
}) {
    return (
        <span
            className={cn(
                'inline-flex rounded-full px-3 py-1.5 text-xs font-black whitespace-nowrap',
                styles[status],
            )}
        >
            {label}
        </span>
    );
}
