import type { ReactNode } from 'react';

/**
 * The page heading used across PROWARE (from V1): a small blue
 * "STI PROWARE" label, the page title, a short description, and the
 * page's main buttons on the right.
 */
export default function PageHeader({
    title,
    description,
    actions,
}: {
    title: string;
    description?: string;
    actions?: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
                <p className="text-sm font-bold tracking-wide text-blue-600 uppercase">
                    STI PROWARE
                </p>
                <h1 className="mt-1 text-3xl font-black text-slate-900">
                    {title}
                </h1>
                {description && (
                    <p className="mt-2 text-sm text-slate-500">{description}</p>
                )}
            </div>

            {actions && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    {actions}
                </div>
            )}
        </div>
    );
}
