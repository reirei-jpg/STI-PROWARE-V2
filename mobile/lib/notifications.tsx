import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';

import { useAuth } from './auth';

type NotificationsContextValue = {
    /** How many notices the student has not read (the bell's badge). */
    unreadCount: number;
    /** Ask the server again. */
    refresh: () => Promise<void>;
    /** Show a count the server just answered with. */
    setUnreadCount: (count: number) => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

/**
 * The unread count for the bell on Home, shared with the Notifications
 * screen so reading a notice updates the badge at once.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
    const { user, request } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);

    const refresh = useCallback(async () => {
        const page = await request<{ unread_count: number }>('/notifications?page=1');

        setUnreadCount(page.unread_count);
    }, [request]);

    useEffect(() => {
        if (user === null) {
            setUnreadCount(0);

            return;
        }

        refresh().catch(() => undefined);
    }, [user, refresh]);

    const value = useMemo(
        () => ({ unreadCount, refresh, setUnreadCount }),
        [unreadCount, refresh],
    );

    return (
        <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
    );
}

export function useNotifications(): NotificationsContextValue {
    const context = useContext(NotificationsContext);

    if (!context) {
        throw new Error('useNotifications must be used inside <NotificationsProvider>.');
    }

    return context;
}
