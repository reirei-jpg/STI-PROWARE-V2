import { usePage } from '@inertiajs/react';
import { Menu } from 'lucide-react';
import { useState } from 'react';
import AccountMenu from '@/components/account-menu';
import NotificationBell from '@/components/notification-bell';
import {
    StaffSidebarContent,
    useWorkspaceName,
} from '@/components/app-sidebar';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetTitle,
} from '@/components/ui/sheet';
import type { Auth, UserRole } from '@/types';

const workspaceDescriptions: Record<UserRole, string> = {
    specialist: 'eStore purchase orders and deliveries from STI Head Office',
    school_admin: 'Monitoring of eStore orders and deliveries',
};

/**
 * The white bar across the top (as in V1): workspace name on the left,
 * account menu on the right. On small screens it also opens the menu.
 */
export default function StaffTopBar() {
    const { auth } = usePage<{ auth: Auth }>().props;
    const workspaceName = useWorkspaceName();
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <header className="fixed top-0 right-0 left-0 z-20 flex h-20 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 shadow-sm md:left-72 md:px-8">
            <div className="flex min-w-0 items-center gap-3">
                <button
                    type="button"
                    onClick={() => setMenuOpen(true)}
                    className="rounded-xl p-2 text-slate-600 transition hover:bg-slate-100 md:hidden"
                    aria-label="Open menu"
                >
                    <Menu size={22} />
                </button>

                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                        {workspaceName}
                    </p>
                    <p className="mt-1 hidden truncate text-xs text-slate-500 sm:block">
                        {workspaceDescriptions[auth.user.role]}
                    </p>
                </div>
            </div>

            <div className="flex shrink-0 items-center gap-4">
                <NotificationBell />
                <AccountMenu />
            </div>

            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetContent
                    side="left"
                    className="w-72 border-none p-0 [&>button]:text-white"
                >
                    <SheetTitle className="sr-only">Menu</SheetTitle>
                    <SheetDescription className="sr-only">
                        Go to another page
                    </SheetDescription>
                    <StaffSidebarContent
                        onNavigate={() => setMenuOpen(false)}
                    />
                </SheetContent>
            </Sheet>
        </header>
    );
}
