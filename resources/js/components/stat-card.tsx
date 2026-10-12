import { Link } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** PROWARE's colors (from V1): amber waiting, blue in progress, green good news, red needs attention. */
const toneClasses = {
    blue: {
        icon: 'bg-blue-50 text-blue-600',
        ring: 'ring-blue-400',
        value: 'text-slate-900',
    },
    amber: {
        icon: 'bg-amber-50 text-amber-600',
        ring: 'ring-amber-400',
        value: 'text-slate-900',
    },
    green: {
        icon: 'bg-emerald-50 text-emerald-600',
        ring: 'ring-emerald-400',
        value: 'text-emerald-700',
    },
    red: {
        icon: 'bg-red-50 text-red-600',
        ring: 'ring-red-400',
        value: 'text-red-600',
    },
} as const;

export type StatCardTone = keyof typeof toneClasses;

/**
 * A number at the top of a back-office page, the same on every page: its
 * icon, a short label, the number, and a line saying what it means. A card
 * with onClick shows its list when clicked, and is outlined while shown; a
 * card with href opens that page.
 */
export default function StatCard({
    icon: Icon,
    tone = 'blue',
    label,
    value,
    detail,
    note,
    active = false,
    colorValue = false,
    onClick,
    href,
}: {
    icon: LucideIcon;
    tone?: StatCardTone;
    label: string;
    value: string | number;
    detail?: string;
    note?: string;
    active?: boolean;
    /** Show the number itself in green or red, e.g. a profit or a loss. */
    colorValue?: boolean;
    onClick?: () => void;
    href?: string;
}) {
    const content = (
        <>
            <span
                className={cn(
                    'flex size-11 shrink-0 items-center justify-center rounded-2xl',
                    toneClasses[tone].icon,
                )}
            >
                <Icon size={21} />
            </span>
            <span className="mt-4 text-xs font-black tracking-wide text-slate-500 uppercase">
                {label}
            </span>
            <span
                className={cn(
                    'mt-0.5 text-3xl font-black tracking-tight break-words',
                    colorValue ? toneClasses[tone].value : 'text-slate-900',
                )}
            >
                {typeof value === 'number'
                    ? value.toLocaleString('en-PH')
                    : value}
            </span>
            {detail && <span className="text-sm text-slate-500">{detail}</span>}
            {note && (
                <span className="mt-2 text-xs font-bold text-amber-700">
                    {note}
                </span>
            )}
        </>
    );
    const classes = cn(
        'flex flex-col rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm',
        active && `ring-2 ${toneClasses[tone].ring}`,
    );

    if (href) {
        return (
            <Link
                href={href}
                className={cn(
                    classes,
                    'transition hover:-translate-y-0.5 hover:shadow-md',
                )}
            >
                {content}
            </Link>
        );
    }

    return onClick ? (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={cn(
                classes,
                'transition hover:-translate-y-0.5 hover:shadow-md',
            )}
        >
            {content}
        </button>
    ) : (
        <article className={classes}>{content}</article>
    );
}
