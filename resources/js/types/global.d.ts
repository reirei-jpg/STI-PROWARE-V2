import type { Auth } from '@/types/auth';
import type { StaffNotifications } from '@/types/notifications';

declare module 'react' {
    interface InputHTMLAttributes<T> {
        passwordrules?: string;
    }
}

declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: {
            name: string;
            auth: Auth;
            notifications: StaffNotifications | null;
            /** How many lines are in a signed-in student's cart; null for others. */
            cart_count: number | null;
            [key: string]: unknown;
        };
    }
}
