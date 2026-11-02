import type { ReactNode } from 'react';

export type FlashToast = {
    type: 'success' | 'info' | 'warning' | 'error';
    message: string;
    /** Which situation it is, so its icon and title tell it at a glance. */
    kind?:
        | 'offline'
        | 'unreachable'
        | 'session-expired'
        | 'page-reloaded'
        | 'cart';
};

export type AuthLayoutProps = {
    children?: ReactNode;
    name?: string;
    title?: string;
    description?: string;
};
