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

/**
 * The box around a long list's table: it fits the screen and scrolls inside,
 * so the column headings stay at the top and the sideways scrollbar is
 * always in view, without scrolling down to the end of the list first.
 */
export function TableScroll({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'max-h-[70vh] overflow-auto overscroll-x-contain',
                '[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_thead_th]:bg-slate-50 [&_thead_th]:shadow-[inset_0_-1px_0_var(--color-slate-200)]',
                className,
            )}
        >
            {children}
        </div>
    );
}
