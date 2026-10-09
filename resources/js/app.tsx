import { createInertiaApp } from '@inertiajs/react';
import FlashPopup from '@/components/flash-popup';
import { TooltipProvider } from '@/components/ui/tooltip';
import { initializeTheme } from '@/hooks/use-appearance';
import AppLayout from '@/layouts/app-layout';
import AuthLayout from '@/layouts/auth-layout';
import SettingsLayout from '@/layouts/settings/layout';
import StorefrontLayout from '@/layouts/storefront-layout';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

void createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    layout: (name) => {
        switch (true) {
            // Printed documents (the issuance slip) stand alone on the page.
            case name.startsWith('print/'):
                return null;
            case name.startsWith('storefront/'):
                return StorefrontLayout;
            case name.startsWith('auth/'):
                return AuthLayout;
            case name.startsWith('settings/'):
                return [AppLayout, SettingsLayout];
            default:
                return AppLayout;
        }
    },
    strictMode: true,
    withApp(app) {
        return (
            <TooltipProvider delayDuration={0}>
                {app}
                <FlashPopup />
            </TooltipProvider>
        );
    },
    progress: {
        color: '#0D6EFD',
    },
});

// STI PROWARE is light mode only for now...
initializeTheme();
