import { Link } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A number at a glance (from V1), e.g. "Orders Uploaded: 12". With onClick
 * or href it is a shortcut: the whole card is a button or a link, with what
 * it opens written at the bottom (actionLabel). Active marks the card whose
 * filter the list below is showing.
 */
export default function SummaryCard({
    label,
    value,
    description,
    icon: Icon,
    onClick,
    href,
    actionLabel,
    active = false,
    testId,
}: {
    label: string;
    value: string;
    description: string;
    icon: LucideIcon;
    onClick?: () => void;
    href?: string;
    actionLabel?: string;
    active?: boolean;
    testId?: string;
}) {
    const clickable = onClick !== undefined || href !== undefined;

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
            {clickable && actionLabel && (
                <p className="mt-3 inline-flex items-center gap-1 text-sm font-black text-blue-700">
                    {actionLabel}
                    <ChevronRight size={15} />
                </p>
            )}
        </>
    );

    const cardClasses = cn(
        'rounded-3xl border border-slate-200 bg-white p-5 shadow-sm',
        active && 'border-blue-400 ring-2 ring-blue-100',
    );

    if (!clickable) {
        return (
            <article data-test={testId} className={cardClasses}>
                {content}
            </article>
        );
    }

    const clickableClasses = cn(
        cardClasses,
        'block w-full text-left transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md',
    );

    if (href !== undefined) {
        return (
            <Link href={href} data-test={testId} className={clickableClasses}>
                {content}
            </Link>
        );
    }

    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            data-test={testId}
            className={clickableClasses}
        >
            {content}
        </button>
    );
}
