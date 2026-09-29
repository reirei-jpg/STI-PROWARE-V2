import { router } from '@inertiajs/react';
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FlashToast } from '@/types';

const AUTO_CLOSE_AFTER_MS = 6000;

const styles: Record<
    FlashToast['type'],
    {
        title: string;
        icon: LucideIcon;
        border: string;
        badge: string;
        heading: string;
    }
> = {
    success: {
        title: 'Success',
        icon: CheckCircle2,
        border: 'border-emerald-200',
        badge: 'bg-emerald-100 text-emerald-600',
        heading: 'text-emerald-700',
    },
    error: {
        title: 'Unable to Continue',
        icon: XCircle,
        border: 'border-red-200',
        badge: 'bg-red-100 text-red-600',
        heading: 'text-red-700',
    },
    warning: {
        title: 'Please Check',
        icon: TriangleAlert,
        border: 'border-amber-200',
        badge: 'bg-amber-100 text-amber-600',
        heading: 'text-amber-700',
    },
    info: {
        title: 'Notice',
        icon: Info,
        border: 'border-blue-200',
        badge: 'bg-blue-100 text-blue-600',
        heading: 'text-blue-700',
    },
};

/**
 * The message popup from V1: shown in the middle of the screen after an
 * action (e.g. "Purchase order saved."), closing by itself after a few
 * seconds or when the user closes it.
 */
export default function FlashPopup() {
    const [message, setMessage] = useState<FlashToast | null>(null);

    useEffect(() => {
        return router.on('flash', (event) => {
            const flash = (event as CustomEvent).detail?.flash;
            const toast = flash?.toast as FlashToast | undefined;

            if (toast) {
                setMessage(toast);
            }
        });
    }, []);

    useEffect(() => {
        if (!message) {
            return;
        }

        const timer = window.setTimeout(
            () => setMessage(null),
            AUTO_CLOSE_AFTER_MS,
        );

        return () => window.clearTimeout(timer);
    }, [message]);

    if (!message) {
        return null;
    }

    const style = styles[message.type];
    const Icon = style.icon;

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/20 p-4"
            onClick={() => setMessage(null)}
        >
            <div
                role="alert"
                aria-live="assertive"
                onClick={(event) => event.stopPropagation()}
                className={`flex w-full max-w-lg items-start gap-4 rounded-2xl border bg-white p-6 shadow-2xl ${style.border}`}
            >
                <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${style.badge}`}
                >
                    <Icon size={22} />
                </div>

                <div className="min-w-0 flex-1">
                    <p className={`text-lg font-bold ${style.heading}`}>
                        {style.title}
                    </p>
                    <p className="mt-2 text-base leading-6 text-slate-600">
                        {message.message}
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => setMessage(null)}
                    className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Close message"
                >
                    <X size={18} />
                </button>
            </div>
        </div>
    );
}
