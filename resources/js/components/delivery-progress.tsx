import { cn } from '@/lib/utils';
import type { DeliveryProgress as Progress, DeliveryStatus } from '@/types';

const badgeStyles: Record<DeliveryStatus, string> = {
    awaiting: 'bg-slate-100 text-slate-700',
    partially_received: 'bg-amber-100 text-amber-800',
    completed: 'bg-emerald-100 text-emerald-700',
    completed_short: 'bg-red-100 text-red-700',
};

const barStyles: Record<DeliveryStatus, string> = {
    awaiting: 'bg-slate-300',
    partially_received: 'bg-amber-500',
    completed: 'bg-emerald-500',
    completed_short: 'bg-red-400',
};

export function DeliveryStatusBadge({
    status,
    label,
}: {
    status: DeliveryStatus;
    label: string;
}) {
    return (
        <span
            className={cn(
                'inline-flex rounded-full px-3 py-1.5 text-xs font-black whitespace-nowrap',
                badgeStyles[status],
            )}
        >
            {label}
        </span>
    );
}

/**
 * The delivery status with a progress bar, e.g. "60% · 1,800 of 3,000".
 */
export default function DeliveryProgress({
    progress,
    className,
}: {
    progress: Progress;
    className?: string;
}) {
    return (
        <div className={cn('min-w-44', className)}>
            <DeliveryStatusBadge
                status={progress.delivery_status}
                label={progress.delivery_status_label}
            />
            <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
                role="progressbar"
                aria-valuenow={progress.percent_received}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Received"
            >
                <div
                    className={cn(
                        'h-full rounded-full transition-all',
                        barStyles[progress.delivery_status],
                    )}
                    style={{ width: `${progress.percent_received}%` }}
                />
            </div>
            <p className="mt-1 text-xs text-slate-500">
                {progress.percent_received}% ·{' '}
                {progress.quantity_received_total.toLocaleString('en-PH')} of{' '}
                {progress.quantity_ordered_total.toLocaleString('en-PH')}{' '}
                received
            </p>
        </div>
    );
}
