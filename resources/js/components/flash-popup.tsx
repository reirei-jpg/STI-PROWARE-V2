import { router } from '@inertiajs/react';
import {
    CheckCircle2,
    CloudOff,
    Info,
    LockKeyhole,
    RefreshCw,
    ShoppingCart,
    TriangleAlert,
    WifiOff,
    X,
    XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FlashToast } from '@/types';

const AUTO_CLOSE_AFTER_MS = 6000;

const SHOW_TOAST_EVENT = 'proware:toast';

/**
 * Show the popup from the browser itself, for what the server cannot say
 * (e.g. when it could not be reached at all).
 */
export function showToast(toast: FlashToast): void {
    window.dispatchEvent(new CustomEvent(SHOW_TOAST_EVENT, { detail: toast }));
}

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
        title: 'Attention',
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

/** The situations with their own icon and title (colors follow the type). */
const kinds: Record<
    NonNullable<FlashToast['kind']>,
    { title: string; icon: LucideIcon }
> = {
    offline: { title: 'You are offline', icon: WifiOff },
    unreachable: { title: 'Connection problem', icon: CloudOff },
    'session-expired': { title: 'Session expired', icon: LockKeyhole },
    'page-reloaded': { title: 'Page reloaded', icon: RefreshCw },
    cart: { title: 'Added to cart', icon: ShoppingCart },
};

/** The colored stripe on top of the popup, by type. */
const stripes: Record<FlashToast['type'], string> = {
    success: 'bg-emerald-500',
    error: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500',
};

/**
 * The message popup from V1: shown in the middle of the screen after an
 * action (e.g. "Purchase order saved."), closing by itself after a few
 * seconds or when the user closes it. A success with Undo also closes by
 * itself (undo is enough to fix a mistake). One that must be read stays
 * until it is closed: an error or warning (nothing happened, or something
 * needs attention), and one with a next-step button.
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
        const show = (event: Event) =>
            setMessage((event as CustomEvent<FlashToast>).detail);

        window.addEventListener(SHOW_TOAST_EVENT, show);

        return () => window.removeEventListener(SHOW_TOAST_EVENT, show);
    }, []);

    useEffect(() => {
        // An error or warning, and a message with a next step, stay until
        // closed; a success (even with Undo) closes by itself.
        const mustBeRead =
            message?.type === 'error' ||
            message?.type === 'warning' ||
            (message?.action !== undefined && message.action.method !== 'post');

        if (!message || mustBeRead) {
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
    const kind = message.kind ? kinds[message.kind] : null;
    const Icon = kind?.icon ?? style.icon;

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/20 p-4"
            onClick={() => setMessage(null)}
        >
            <div
                role="alert"
                aria-live="assertive"
                onClick={(event) => event.stopPropagation()}
                className={`w-full max-w-lg overflow-hidden rounded-2xl border bg-white shadow-2xl ${style.border}`}
            >
                <div className={`h-1.5 ${stripes[message.type]}`} />
                <div className="flex items-start gap-4 p-6">
                    <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${style.badge}`}
                    >
                        <Icon size={26} />
                    </div>

                    <div className="min-w-0 flex-1">
                        <p className={`text-lg font-bold ${style.heading}`}>
                            {kind?.title ?? style.title}
                        </p>
                        <p className="mt-1.5 text-base leading-6 text-slate-600">
                            {message.message}
                        </p>
                        {message.action && (
                            <button
                                type="button"
                                onClick={() => {
                                    const action = message.action;
                                    setMessage(null);

                                    if (!action) {
                                        return;
                                    }

                                    if (action.method === 'post') {
                                        router.post(
                                            action.href,
                                            action.data ?? {},
                                            {
                                                preserveScroll: true,
                                            },
                                        );

                                        return;
                                    }

                                    router.visit(action.href);
                                }}
                                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#0D6EFD] px-4 py-2.5 text-sm font-black text-white transition hover:bg-blue-700"
                            >
                                {message.action.label}
                            </button>
                        )}
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
        </div>
    );
}
