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
            showToast(
                navigator.onLine
                    ? {
                          type: 'error',
                          kind: 'unreachable',
                          message:
                              'PROWARE could not be reached, so nothing was saved. Check your internet connection and try again.',
                      }
                    : {
                          type: 'error',
                          kind: 'offline',
                          message:
                              'You are offline, so nothing was saved. Check your internet connection and try again.',
                      },
            );
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
            <Notice
                className="bg-red-600 text-white"
                icon={WifiOff}
                title="You are offline"
            >
                Check your internet connection; nothing on this page is lost.
            </Notice>
        );
    }

    if (slow) {
        return (
            <Notice
                className="bg-amber-500 text-white"
                icon={Hourglass}
                title="Still loading"
            >
                Your internet connection is slow.
            </Notice>
        );
    }

    if (backOnline) {
        return (
            <Notice
                className="bg-emerald-600 text-white"
                icon={Wifi}
                title="Back online"
            >
                Your internet connection is working again.
            </Notice>
        );
    }

    return null;
}

/** A colored card at the top: its icon and title tell the situation at a glance. */
function Notice({
    className,
    icon: Icon,
    title,
    children,
}: {
    className: string;
    icon: typeof Wifi;
    title: string;
    children: ReactNode;
}) {
    return (
        <div
            role="status"
            aria-live="polite"
            className="pointer-events-none fixed inset-x-0 top-3 z-9998 flex justify-center px-4"
        >
            <div
                className={`flex max-w-xl items-center gap-3 rounded-2xl px-4 py-3 shadow-lg ${className}`}
            >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20">
                    <Icon size={20} />
                </span>
                <span className="text-sm leading-5">
                    <span className="block font-black">{title}</span>
                    <span className="font-semibold">{children}</span>
                </span>
            </div>
        </div>
    );
}
