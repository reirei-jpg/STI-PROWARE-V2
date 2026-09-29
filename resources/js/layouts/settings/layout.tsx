import { Link } from '@inertiajs/react';
import type { PropsWithChildren } from 'react';
import PageHeader from '@/components/page-header';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { toUrl } from '@/lib/utils';
import { edit } from '@/routes/profile';
import { edit as editSecurity } from '@/routes/security';
import type { NavItem } from '@/types';

const settingsNavItems: NavItem[] = [
    {
        title: 'Profile',
        href: edit(),
        icon: null,
    },
    {
        title: 'Security',
        href: editSecurity(),
        icon: null,
    },
];

export default function SettingsLayout({ children }: PropsWithChildren) {
    const { isCurrentOrParentUrl } = useCurrentUrl();

    return (
        <div className="space-y-7">
            <PageHeader
                title="Settings"
                description="Manage your profile and account security."
            />

            <div className="flex flex-col gap-6 lg:flex-row">
                <nav
                    className="flex gap-2 lg:w-52 lg:flex-col"
                    aria-label="Settings"
                >
                    {settingsNavItems.map((item) => (
                        <Link
                            key={toUrl(item.href)}
                            href={item.href}
                            className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                                isCurrentOrParentUrl(item.href)
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            {item.title}
                        </Link>
                    ))}
                </nav>

                <section className="flex-1 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:max-w-3xl">
                    <div className="max-w-xl space-y-12">{children}</div>
                </section>
            </div>
        </div>
    );
}
