import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A number at a glance (from V1), e.g. "Orders Uploaded: 12". With
 * onClick it is a shortcut: the whole card is a button, with what it opens
 * written at the bottom (actionLabel).
 */
export default function SummaryCard({
    label,
    value,
    description,
    icon: Icon,
    onClick,
    actionLabel,
}: {
    label: string;
    value: string;
    description: string;
    icon: LucideIcon;
    onClick?: () => void;
    actionLabel?: string;
}) {
    const content = (
        <>
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-600">{label}</p>
                    <p className="mt-2 truncate text-3xl font-black text-slate-950">
                        {value}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-slate-400">
                        {description}
                    </p>
                </div>

                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Icon size={20} />
                </div>
            </div>
            {onClick && actionLabel && (
                <p className="mt-3 inline-flex items-center gap-1 text-sm font-black text-blue-700">
                    {actionLabel}
                    <ChevronRight size={15} />
                </p>
            )}
        </>
    );

    const cardClasses =
        'rounded-3xl border border-slate-200 bg-white p-5 shadow-sm';

    if (!onClick) {
        return <article className={cardClasses}>{content}</article>;
    }

    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                cardClasses,
                'block w-full text-left transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md',
            )}
        >
            {content}
        </button>
    );
}
