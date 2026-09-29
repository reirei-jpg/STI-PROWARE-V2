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
            [key: string]: unknown;
        };
    }
}
