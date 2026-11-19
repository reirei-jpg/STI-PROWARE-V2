import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The name of a box that must be filled in, as "*Product name required":
 * a red star before it and "required" after it, both in red. Used on every
 * form, so the Specialist always sees which boxes are needed.
 */
export default function RequiredLabel({
    required = true,
    children,
}: {
    required?: boolean;
    children: ReactNode;
}) {
    if (!required) {
        return <span>{children}</span>;
    }

    return (
        <span>
            <span aria-hidden="true" className="mr-0.5 text-red-600">
                *
            </span>
            {children}
            <span className="ml-1.5 text-xs font-bold text-red-600 normal-case">
                required
            </span>
        </span>
    );
}

/**
 * The sentence at the top of a form: boxes marked "* required" must be
 * filled in before its save button can be clicked.
 */
export function RequiredNote({
    saveLabel,
    className,
}: {
    /** The save button's words, e.g. "Save Product". */
    saveLabel: string;
    className?: string;
}) {
    return (
        <p
            className={cn(
                'rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm text-slate-700 shadow-sm',
                className,
            )}
        >
            Fields marked <span className="font-black text-red-600">*</span>{' '}
            <span className="text-xs font-bold text-red-600">required</span>{' '}
            must be filled in before {saveLabel} can be clicked.
        </p>
    );
}
