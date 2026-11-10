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
    /**
     * A button for the next step, e.g. "Link the new items" (opens a page), or
     * Undo (sent as a form with `method` and `data`, e.g. putting a removed
     * cart line back).
     */
    action?: {
        label: string;
        href: string;
        method?: 'post';
        data?: Record<string, string | number | boolean | null>;
    };
};

export type AuthLayoutProps = {
    children?: ReactNode;
    name?: string;
    title?: string;
    description?: string;
};
