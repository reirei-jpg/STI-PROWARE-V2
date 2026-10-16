import { Link } from '@inertiajs/react';
import { KeyRound, UserRound } from 'lucide-react';
import type { PropsWithChildren } from 'react';
import PageHeader from '@/components/page-header';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { cn, toUrl } from '@/lib/utils';
import { edit } from '@/routes/profile';
import { edit as editSecurity } from '@/routes/security';

const settingsTabs = [
    { title: 'Profile', href: edit(), icon: UserRound },
    { title: 'Password', href: editSecurity(), icon: KeyRound },
];

/**
 * Account settings for staff: their profile (name) and their password, as
 * two tabs above one card, like the other PROWARE pages.
 */
export default function SettingsLayout({ children }: PropsWithChildren) {
    const { isCurrentOrParentUrl } = useCurrentUrl();

    return (
        <div className="space-y-6">
            <PageHeader
                title="Settings"
                description="Your name and your password."
            />

            <nav className="flex flex-wrap gap-2" aria-label="Settings">
                {settingsTabs.map((tab) => (
                    <Link
                        key={toUrl(tab.href)}
                        href={tab.href}
                        className={cn(
                            'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition',
                            isCurrentOrParentUrl(tab.href)
                                ? 'bg-[#0D6EFD] text-white shadow-sm'
                                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                        )}
                    >
                        <tab.icon size={16} />
                        {tab.title}
                    </Link>
                ))}
            </nav>

            <div className="max-w-2xl">{children}</div>
        </div>
    );
}
