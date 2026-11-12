import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/**
 * Keeps one record on screen up to date, like an order: it is loaded again
 * when the screen comes back into view or the app comes back to the front,
 * and every 10 seconds while `live` (e.g. the order is still open). So a
 * step taken elsewhere (released at the office, cancelled by the buyer)
 * shows by itself, and buttons that no longer apply, like Cancel, go away.
 * The screen still does its own first load.
 */
export function useLiveReload(load: () => Promise<unknown>, live: boolean, everyMs = 10000): void {
    const firstFocus = useRef(true);

    useFocusEffect(
        useCallback(() => {
            if (firstFocus.current) {
                firstFocus.current = false;

                return;
            }

            void load();
        }, [load]),
    );

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') {
                void load();
            }
        });

        return () => subscription.remove();
    }, [load]);

    useEffect(() => {
        if (!live) {
            return;
        }

        const timer = setInterval(() => {
            if (AppState.currentState === 'active') {
                void load();
            }
        }, everyMs);

        return () => clearInterval(timer);
    }, [live, load, everyMs]);
}
