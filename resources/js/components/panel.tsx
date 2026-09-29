import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A white rounded card with an optional title bar (from V1).
 */
export default function Panel({
    title,
    description,
    actions,
    className,
    children,
}: {
    title?: string;
    description?: ReactNode;
    actions?: ReactNode;
    className?: string;
    children: ReactNode;
}) {
    return (
        <section
            className={cn(
                'overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm',
                className,
            )}
        >
            {title && (
                <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="font-black text-slate-900">{title}</h2>
                        {description && (
                            <div className="mt-1 text-sm text-slate-500">
                                {description}
                            </div>
                        )}
                    </div>
                    {actions}
                </div>
            )}

            {children}
        </section>
    );
}

/**
 * A column heading in a V1-style table.
 */
export function TableHeading({
    children,
    align = 'left',
}: {
    children: ReactNode;
    align?: 'left' | 'right';
}) {
    return (
        <th
            className={cn(
                'px-5 py-4 text-xs font-black tracking-wide whitespace-nowrap text-slate-400 uppercase',
                align === 'right' ? 'text-right' : 'text-left',
            )}
        >
            {children}
        </th>
    );
}
