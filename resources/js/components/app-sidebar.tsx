import { Link, usePage } from '@inertiajs/react';
import {
    ClipboardList,
    FileScan,
    LayoutDashboard,
    Package,
    Truck,
} from 'lucide-react';
import DeliveryController from '@/actions/App/Http/Controllers/DeliveryController';
import ProductController from '@/actions/App/Http/Controllers/ProductController';
import PurchaseOrderController from '@/actions/App/Http/Controllers/PurchaseOrderController';
import PurchaseOrderScanController from '@/actions/App/Http/Controllers/PurchaseOrderScanController';
import SidebarBrand from '@/components/sidebar-brand';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { toUrl } from '@/lib/utils';
import { dashboard } from '@/routes';
import type { Auth, NavItem, UserRole } from '@/types';

const workspaceNames: Record<UserRole, string> = {
    specialist: 'Specialist Workspace',
    school_admin: 'School Admin Workspace',
};

/**
 * The name of the signed-in user's workspace, e.g. "Specialist Workspace".
 */
export function useWorkspaceName(): string {
    const { auth } = usePage<{ auth: Auth }>().props;

    return workspaceNames[auth.user.role];
}

function useStaffMenuItems(): NavItem[] {
    const { auth } = usePage<{ auth: Auth }>().props;

    const items: NavItem[] = [
        { title: 'Dashboard', href: dashboard(), icon: LayoutDashboard },
        {
            title: 'Purchase Orders',
            href: PurchaseOrderController.index(),
            icon: ClipboardList,
        },
    ];

    if (auth.user.role === 'specialist') {
        items.push(
            {
                title: 'Scan eStore PO',
                href: PurchaseOrderScanController.create(),
                icon: FileScan,
            },
            {
                title: 'Deliveries',
                href: DeliveryController.index(),
                icon: Truck,
            },
            {
                title: 'Products',
                href: ProductController.index(),
                icon: Package,
            },
        );
    }

    return items;
}

/**
 * The menu links, as in V1: white text on blue, the current page as a
 * white pill. When several links match the current address, the most
 * specific one wins (so "Scan eStore PO" is highlighted on the scan page,
 * not "Purchase Orders").
 */
export function StaffMenu({ onNavigate }: { onNavigate?: () => void }) {
    const items = useStaffMenuItems();
    const { currentUrl } = useCurrentUrl();

    const activePath = items
        .map((item) => toUrl(item.href))
        .filter(
            (path) => currentUrl === path || currentUrl.startsWith(`${path}/`),
        )
        .sort((a, b) => b.length - a.length)[0];

    return (
        <nav className="space-y-1.5">
            {items.map((item) => {
                const Icon = item.icon;
                const active = toUrl(item.href) === activePath;

                return (
                    <Link
                        key={item.title}
                        href={item.href}
                        onClick={onNavigate}
                        className={`flex items-center gap-4 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                            active
                                ? 'bg-white text-[#0D6EFD] shadow-sm'
                                : 'text-blue-50 hover:bg-white/15 hover:text-white'
                        }`}
                    >
                        {Icon && <Icon size={19} />}
                        <span>{item.title}</span>
                    </Link>
                );
            })}
        </nav>
    );
}

/**
 * The blue sidebar content: logo, menu and footer.
 */
export function StaffSidebarContent({
    onNavigate,
}: {
    onNavigate?: () => void;
}) {
    const workspaceName = useWorkspaceName();

    return (
        <div className="flex h-full flex-col bg-[#0D6EFD] px-5 py-7 text-white">
            <SidebarBrand subtitle={workspaceName} />

            <div className="mt-8 border-t border-white/10" />

            <div className="mt-6">
                <StaffMenu onNavigate={onNavigate} />
            </div>

            <div className="mt-auto pt-10">
                <div className="border-t border-white/10 pt-5">
                    <p className="px-3 text-xs font-medium text-blue-100">
                        STI PROWARE
                    </p>
                    <p className="mt-1 px-3 text-[11px] text-blue-200/70">
                        Version 2.0
                    </p>
                </div>
            </div>
        </div>
    );
}

/**
 * The fixed blue sidebar shown on larger screens.
 */
export function AppSidebar() {
    return (
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 overflow-y-auto md:block">
            <StaffSidebarContent />
        </aside>
    );
}
