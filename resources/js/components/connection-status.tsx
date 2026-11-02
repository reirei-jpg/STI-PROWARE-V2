import { router } from '@inertiajs/react';
import { Hourglass, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { showToast } from '@/components/flash-popup';

/** A page still loading after this long gets a "slow connection" note. */
const SLOW_AFTER_MS = 8000;

/** How long "You are back online" stays. */
const BACK_ONLINE_FOR_MS = 4000;

/**
 * The internet connection, said in words at the top of every page: a bar
 * while the computer is offline, a short note when it is back, a note when
 * a page takes long to load, and a message when a button could not reach
 * PROWARE (instead of nothing happening).
 */
export default function ConnectionStatus() {
    const [offline, setOffline] = useState(
        typeof navigator !== 'undefined' && !navigator.onLine,
    );
    const [backOnline, setBackOnline] = useState(false);
    const [slow, setSlow] = useState(false);

    useEffect(() => {
        let backOnlineTimer: number | undefined;

        const goOffline = () => {
            window.clearTimeout(backOnlineTimer);
            setBackOnline(false);
            setOffline(true);
        };
        const goOnline = () => {
            setOffline(false);
            setBackOnline(true);
            backOnlineTimer = window.setTimeout(
                () => setBackOnline(false),
                BACK_ONLINE_FOR_MS,
            );
        };

        window.addEventListener('offline', goOffline);
        window.addEventListener('online', goOnline);

        return () => {
            window.removeEventListener('offline', goOffline);
            window.removeEventListener('online', goOnline);
            window.clearTimeout(backOnlineTimer);
        };
    }, []);

    useEffect(() => {
        let slowTimer: number | undefined;

        const stopStart = router.on('start', () => {
            window.clearTimeout(slowTimer);
            slowTimer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
        });
        const stopFinish = router.on('finish', () => {
            window.clearTimeout(slowTimer);
            setSlow(false);
        });
        const stopNetworkError = router.on('networkError', (event) => {
            event.preventDefault();
            showToast({
                type: 'error',
                message: navigator.onLine
                    ? 'PROWARE could not be reached, so nothing was saved. Check the internet connection, then press the button again. What you typed is still on the page.'
                    : 'You are offline, so nothing was saved. Connect to the internet, then press the button again. What you typed is still on the page.',
            });
        });

        return () => {
            stopStart();
            stopFinish();
            stopNetworkError();
            window.clearTimeout(slowTimer);
        };
    }, []);

    if (offline) {
        return (
            <Notice className="bg-red-600 text-white" icon={WifiOff}>
                You are offline. PROWARE works again as soon as the internet is
                back; nothing you typed is lost.
            </Notice>
        );
    }

    if (slow) {
        return (
            <Notice className="bg-amber-500 text-white" icon={Hourglass}>
                Still loading. The connection is slow, so this takes longer than
                usual.
            </Notice>
        );
    }

    if (backOnline) {
        return (
            <Notice className="bg-emerald-600 text-white" icon={Wifi}>
                You are back online.
            </Notice>
        );
    }

    return null;
}

function Notice({
    className,
    icon: Icon,
    children,
}: {
    className: string;
    icon: typeof Wifi;
    children: ReactNode;
}) {
    return (
        <div
            role="status"
            aria-live="polite"
            className="pointer-events-none fixed inset-x-0 top-3 z-9998 flex justify-center px-4"
        >
            <p
                className={`flex max-w-xl items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold shadow-lg ${className}`}
            >
                <Icon size={18} className="shrink-0" />
                <span>{children}</span>
            </p>
        </div>
    );
}
