import { useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { useAuth } from '@/lib/auth';

/**
 * "Leave without saving?" with Keep editing / Leave, in the website's words.
 * `kept` says a draft keeps what was typed (useDraft).
 */
export function askBeforeLeaving(leave: () => void, kept = false): void {
    Alert.alert(
        'Leave without saving?',
        kept
            ? 'What you typed is kept as a draft and comes back when you open this again.'
            : 'What you typed will be lost. This cannot be undone.',
        [
            { text: 'Keep editing', style: 'cancel' },
            { text: 'Leave', style: 'destructive', onPress: leave },
        ],
    );
}

/**
 * While `dirty` (something was typed and not saved yet), leaving the screen
 * asks first: its Back button, the phone's Back button or gesture, or
 * anything else that closes the screen. Saving is not asked about.
 */
export function useUnsavedChanges(dirty: boolean, { kept = false }: { kept?: boolean } = {}): void {
    const navigation = useNavigation();

    usePreventRemove(dirty, ({ data }) => askBeforeLeaving(() => navigation.dispatch(data.action), kept));
}

/** Drafts older than this are dropped instead of brought back. */
const KEEP_FOR_MS = 7 * 24 * 60 * 60 * 1000;

/** Typing is saved after this short pause. */
const SAVE_AFTER_MS = 600;

/**
 * What was typed in a long form, kept on this phone until it is saved: if
 * the screen is left, the app closes or the phone restarts, opening the
 * form again brings it back. Kept per signed-in account and per form, for a
 * week at most (like the website's drafts).
 *
 * `restore` puts a kept draft back; `clear` forgets it once saved; `discard`
 * goes back to the form as it opened.
 */
export function useDraft<T>(name: string, data: T, restore: (saved: T) => void) {
    const { user } = useAuth();
    const key = `proware-draft.${user?.id ?? 'guest'}.${name.replace(/[^A-Za-z0-9._-]/g, '-')}`;
    const opened = useRef(JSON.stringify(data));
    const initial = useRef(opened.current);
    const [ready, setReady] = useState(false);
    const [restored, setRestored] = useState(false);
    const serialized = JSON.stringify(data);

    // Bring back once, when the form opens.
    useEffect(() => {
        let cancelled = false;

        SecureStore.getItemAsync(key)
            .then((raw) => {
                const saved = raw ? (JSON.parse(raw) as { savedAt: number; data: T }) : null;

                if (!cancelled && saved && Date.now() - saved.savedAt < KEEP_FOR_MS && JSON.stringify(saved.data) !== initial.current) {
                    restore(saved.data);
                    setRestored(true);
                }
            })
            .catch(() => undefined)
            .finally(() => !cancelled && setReady(true));

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    useEffect(() => {
        if (!ready) {
            return;
        }

        const timer = setTimeout(() => {
            const write =
                serialized === initial.current
                    ? SecureStore.deleteItemAsync(key)
                    : SecureStore.setItemAsync(key, JSON.stringify({ savedAt: Date.now(), data: JSON.parse(serialized) }));

            // A full or blocked store only means no draft is kept.
            write.catch(() => undefined);
        }, SAVE_AFTER_MS);

        return () => clearTimeout(timer);
    }, [key, ready, serialized]);

    const clear = useCallback(() => {
        initial.current = serialized;
        setRestored(false);
        SecureStore.deleteItemAsync(key).catch(() => undefined);
    }, [key, serialized]);

    const discard = useCallback(() => {
        restore(JSON.parse(opened.current) as T);
        setRestored(false);
        SecureStore.deleteItemAsync(key).catch(() => undefined);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    return { restored, clear, discard, dismiss: () => setRestored(false) };
}
