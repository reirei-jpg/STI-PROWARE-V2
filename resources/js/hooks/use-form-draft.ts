import { usePage } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Drafts older than this are dropped instead of brought back. */
const KEEP_FOR_MS = 7 * 24 * 60 * 60 * 1000;

/** Typing is saved after this short pause. */
const SAVE_AFTER_MS = 500;

type SavedDraft<T> = { savedAt: number; data: T };

function read<T>(key: string): SavedDraft<T> | null {
    try {
        const raw = window.localStorage.getItem(key);
        const saved = raw ? (JSON.parse(raw) as SavedDraft<T>) : null;

        return saved && Date.now() - saved.savedAt < KEEP_FOR_MS ? saved : null;
    } catch {
        return null;
    }
}

function forget(key: string): void {
    try {
        window.localStorage.removeItem(key);
    } catch {
        // Nothing saved, nothing to forget.
    }
}

/**
 * What was typed in a long form, kept on this computer until it is saved:
 * if the sign-in expires, the tab closes or the internet drops, opening the
 * form again brings it back. Kept per signed-in account and per form (e.g.
 * per product), for a week at most.
 *
 * `data` is what to keep (without uploaded files, which cannot be kept);
 * `restore` puts a kept draft back into the form. `announce: false` brings
 * it back without the "brought back" note (e.g. after the page's own step).
 */
export function useFormDraft<T>(
    name: string,
    data: T,
    restore: (saved: T) => void,
    { announce = true }: { announce?: boolean } = {},
) {
    const userId = usePage().props.auth.user?.id ?? 'guest';
    const key = `proware-draft:${userId}:${name}`;
    const [restored, setRestored] = useState(false);
    // The form as it opened, for Discard.
    const opened = useRef(JSON.stringify(data));
    // What is not worth keeping: the form as it opened, or as last saved.
    const initial = useRef(opened.current);
    const latest = useRef(opened.current);
    const ready = useRef(false);

    useEffect(() => {
        const saved = read<T>(key);

        if (saved && JSON.stringify(saved.data) !== initial.current) {
            restore(saved.data);
            setRestored(announce);
        }

        ready.current = true;
        // Bring back once, when the form opens.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    const serialized = JSON.stringify(data);
    latest.current = serialized;

    useEffect(() => {
        if (!ready.current) {
            return;
        }

        const timer = window.setTimeout(() => {
            if (serialized === initial.current) {
                forget(key);

                return;
            }

            try {
                window.localStorage.setItem(
                    key,
                    JSON.stringify({
                        savedAt: Date.now(),
                        data: JSON.parse(serialized),
                    }),
                );
            } catch {
                // A full or blocked storage only means no draft is kept.
            }
        }, SAVE_AFTER_MS);

        return () => window.clearTimeout(timer);
    }, [key, serialized]);

    /** The form was saved: the draft is no longer needed. */
    const clear = useCallback(() => {
        initial.current = latest.current;
        forget(key);
        setRestored(false);
    }, [key]);

    /** Throw the brought-back draft away: the form as it opened. */
    const discard = useCallback(() => {
        restore(JSON.parse(opened.current) as T);
        forget(key);
        setRestored(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    return { restored, clear, discard, dismiss: () => setRestored(false) };
}
