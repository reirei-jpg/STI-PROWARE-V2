import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The tabs that switch a page between its lists (e.g. Received / Waiting
 * to arrive), the same on every page.
 */
export function ViewTabs({ children }: { children: ReactNode }) {
    return (
        <div
            role="tablist"
            className="inline-flex flex-wrap gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1"
        >
            {children}
        </div>
    );
}

export function ViewTab({
    active,
    count,
    icon: Icon,
    onClick,
    children,
}: {
    active: boolean;
    count?: number;
    icon?: LucideIcon;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            role="tab"
            aria-selected={active}
            onClick={onClick}
            className={cn(
                'inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-black transition',
                active
                    ? 'bg-[#0D6EFD] text-white shadow-sm'
                    : 'text-slate-600 hover:bg-white',
            )}
        >
            {Icon && <Icon size={17} />}
            {children}
            {count !== undefined && <Count active={active} count={count} />}
        </button>
    );
}

/**
 * A filter chip that narrows a list (e.g. All / Placed / Ready), the same
 * on every page.
 */
export function FilterChip({
    active,
    count,
    onClick,
    children,
}: {
    active: boolean;
    count?: number;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            aria-pressed={active}
            onClick={onClick}
            className={cn(
                'inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition',
                active
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
        >
            {children}
            {count !== undefined && <Count active={active} count={count} />}
        </button>
    );
}

function Count({ active, count }: { active: boolean; count: number }) {
    return (
        <span
            className={cn(
                'rounded-full px-2 py-0.5 text-xs font-black',
                active ? 'bg-white/25' : 'bg-white text-slate-600',
            )}
        >
            {count.toLocaleString('en-PH')}
        </span>
    );
}
