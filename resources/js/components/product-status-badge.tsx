import { cn } from '@/lib/utils';
import type { ProductStatus } from '@/types';

const styles: Record<ProductStatus, string> = {
    draft: 'bg-slate-100 text-slate-700',
    preorder: 'bg-amber-100 text-amber-800',
    available: 'bg-emerald-100 text-emerald-700',
    on_sale: 'bg-red-100 text-red-700',
};

export default function ProductStatusBadge({
    status,
    label,
}: {
    status: ProductStatus;
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
