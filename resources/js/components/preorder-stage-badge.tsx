import { formatDateOrdered } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PreorderProductSummary, PreorderStage } from '@/types';

/** V1's colors: blue in progress, amber needs action, green good news. */
const stages: Record<PreorderStage, { label: string; className: string }> = {
    open: { label: 'Taking preorders', className: 'bg-blue-100 text-blue-700' },
    to_order: {
        label: 'To order in eStore',
        className: 'bg-amber-100 text-amber-800',
    },
    arrived: { label: 'Arrived', className: 'bg-emerald-100 text-emerald-700' },
};

export const preorderStageLabels: Record<PreorderStage, string> = {
    open: stages.open.label,
    to_order: stages.to_order.label,
    arrived: stages.arrived.label,
};

/** "Taking preorders", "To order in eStore" or "Arrived", in color. */
export default function PreorderStageBadge({
    stage,
}: {
    stage: PreorderStage;
}) {
    return (
        <span
            className={cn(
                'inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-black whitespace-nowrap',
                stages[stage].className,
            )}
        >
            {stages[stage].label}
        </span>
    );
}

/**
 * The date that matters for the stage: when preorders close (in V1's date
 * colors: amber on the last day, blue later), when they closed, or when
 * the students were told it arrived.
 */
export function PreorderWhen({
    product,
    today,
}: {
    product: Pick<
        PreorderProductSummary,
        'stage' | 'preorders_close_on' | 'arrived_at'
    >;
    today: string;
}) {
    if (product.stage === 'arrived') {
        return (
            <span className="font-bold text-emerald-700">
                Students told {formatDateOrdered(product.arrived_at)}
            </span>
        );
    }

    if (product.preorders_close_on === null) {
        return <span className="text-slate-500">No close date</span>;
    }

    if (product.stage === 'to_order') {
        return (
            <span className="font-bold text-amber-700">
                Closed {formatDateOrdered(product.preorders_close_on)}
            </span>
        );
    }

    const days = Math.round(
        (new Date(`${product.preorders_close_on}T00:00:00`).getTime() -
            new Date(`${today}T00:00:00`).getTime()) /
            86_400_000,
    );

    return (
        <span
            className={cn(
                'font-bold',
                days === 0 ? 'text-amber-600' : 'text-blue-700',
            )}
        >
            {days === 0
                ? 'Last day today'
                : days === 1
                  ? 'Closes tomorrow'
                  : `Closes in ${days} days`}
            <span className="font-normal text-slate-500">
                {' '}
                · {formatDateOrdered(product.preorders_close_on)}
            </span>
        </span>
    );
}
