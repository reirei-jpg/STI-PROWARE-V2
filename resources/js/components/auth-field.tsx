import { Eye, EyeOff, LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';

/** The blue link style on the sign-in pages. */
export const authLinkClasses =
    'font-semibold text-blue-600 transition hover:text-blue-700';

/**
 * A V1 round field on the sign-in pages: its icon, the input, an optional
 * button at the end (e.g. show password), and a hint or its error below.
 */
export function AuthField({
    icon,
    input,
    error,
    hint,
    trailing,
}: {
    icon: ReactNode;
    input: ReactNode;
    error?: string;
    hint?: string;
    trailing?: ReactNode;
}) {
    return (
        <div>
            <div
                className={`relative flex items-center rounded-full border transition focus-within:ring-4 ${
                    error
                        ? 'border-red-400 focus-within:border-red-500 focus-within:ring-red-100'
                        : 'border-slate-300 focus-within:border-[#0D6EFD] focus-within:ring-blue-100'
                } [&_input]:w-full [&_input]:rounded-full [&_input]:bg-transparent [&_input]:py-3 [&_input]:pl-12 [&_input]:text-sm [&_input]:font-medium [&_input]:text-slate-900 [&_input]:outline-none [&_input]:placeholder:text-slate-400 [&_input:read-only]:text-slate-500 ${
                    trailing ? '[&_input]:pr-12' : '[&_input]:pr-5'
                }`}
            >
                <span className="pointer-events-none absolute left-4 text-slate-500">
                    {icon}
                </span>
                {input}
                {trailing && (
                    <span className="absolute right-4 flex">{trailing}</span>
                )}
            </div>
            {error ? (
                <p className="mt-1.5 px-4 text-xs text-red-600">{error}</p>
            ) : (
                hint && (
                    <p className="mt-1.5 px-4 text-xs text-slate-500">{hint}</p>
                )
            )}
        </div>
    );
}

/** The eye button that shows or hides a password. */
export function ShowPasswordButton({
    shown,
    onToggle,
}: {
    shown: boolean;
    onToggle: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onToggle}
            className="text-slate-400 transition hover:text-blue-600"
            aria-label={shown ? 'Hide password' : 'Show password'}
        >
            {shown ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
    );
}

/** The big blue button that sends a sign-in form. */
export function AuthSubmitButton({
    processing,
    label,
    processingLabel,
    dataTest,
}: {
    processing: boolean;
    label: string;
    processingLabel: string;
    dataTest?: string;
}) {
    return (
        <button
            type="submit"
            disabled={processing}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-linear-to-r from-[#005BFF] via-[#0D6EFD] to-[#0045CC] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/30 transition hover:-translate-y-0.5 hover:from-blue-600 hover:to-blue-800 focus:ring-4 focus:ring-blue-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            data-test={dataTest}
        >
            {processing && <LoaderCircle size={17} className="animate-spin" />}
            {processing ? processingLabel : label}
        </button>
    );
}

/** A green "done" message at the top of a sign-in page. */
export function AuthStatus({ children }: { children: ReactNode }) {
    return (
        <div
            role="status"
            className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
        >
            {children}
        </div>
    );
}
