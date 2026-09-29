import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowRight, ClipboardList, FileScan } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import PurchaseOrderController from '@/actions/App/Http/Controllers/PurchaseOrderController';
import PurchaseOrderScanController from '@/actions/App/Http/Controllers/PurchaseOrderScanController';
import PageHeader from '@/components/page-header';
import type { Auth } from '@/types';

export default function Dashboard() {
    const { auth } = usePage<{ auth: Auth }>().props;
    const firstName = auth.user.name.split(' ')[0];

    return (
        <>
            <Head title="Dashboard" />

            <div className="space-y-7">
                <PageHeader
                    title={`Welcome, ${firstName}`}
                    description="Here is where your PROWARE work starts."
                />

                {auth.user.role === 'specialist' ? (
                    <section className="grid gap-4 md:grid-cols-2">
                        <ShortcutCard
                            href={PurchaseOrderScanController.create().url}
                            icon={FileScan}
                            title="Scan eStore PO"
                            description="Upload the purchase order file from an eStore email and save it."
                        />
                        <ShortcutCard
                            href={PurchaseOrderController.index().url}
                            icon={ClipboardList}
                            title="Purchase Orders"
                            description="See every eStore order uploaded to PROWARE."
                        />
                    </section>
                ) : (
                    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="font-black text-slate-900">
                            Order monitoring is coming next
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                            You will be able to follow every order the
                            Specialist uploads from the eStore and its delivery
                            progress here.
                        </p>
                    </section>
                )}
            </div>
        </>
    );
}

function ShortcutCard({
    href,
    icon: Icon,
    title,
    description,
}: {
    href: string;
    icon: LucideIcon;
    title: string;
    description: string;
}) {
    return (
        <Link
            href={href}
            className="group flex items-start gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-200 hover:shadow-md"
        >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Icon size={22} />
            </div>
            <div className="min-w-0 flex-1">
                <p className="font-black text-slate-900">{title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                    {description}
                </p>
            </div>
            <ArrowRight
                size={18}
                className="mt-1 shrink-0 text-slate-300 transition group-hover:text-blue-600"
            />
        </Link>
    );
}
