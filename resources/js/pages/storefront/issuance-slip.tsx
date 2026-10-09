import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    Ban,
    CheckCircle2,
    Clock,
    PackageCheck,
    Printer,
} from 'lucide-react';
import type { ReactNode } from 'react';
import StudentOrderController from '@/actions/App/Http/Controllers/StudentOrderController';
import IssuanceSlip from '@/components/issuance-slip';
import { formatDateOrdered, formatPeso } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { IssuanceSlipData } from '@/types';

/**
 * The student's issuance slip for an order: show it (on the phone or
 * printed) at the PROWARE office, where the Specialist scans its QR, the
 * student pays, and the items are released. Above it, what to do next in
 * V1's colors: amber waiting, green ready or released, red cancelled.
 */
export default function StudentIssuanceSlip({
    slip,
}: {
    slip: IssuanceSlipData;
}) {
    return (
        <>
            <Head title={`Issuance Slip ${slip.number ?? ''}`} />

            <div className="space-y-5">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900">
                            Issuance Slip
                        </h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Order {slip.number}. This is your receipt for the
                            order.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Link
                            href={StudentOrderController.index()}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"
                        >
                            <ArrowLeft size={17} />
                            Back to My Orders
                        </Link>
                        {slip.status !== 'cancelled' && (
                            <a
                                href={
                                    StudentOrderController.printSlip(
                                        slip.order_id,
                                    ).url
                                }
                                target="_blank"
                                rel="noopener"
                                className="inline-flex items-center gap-2 rounded-xl bg-[#0D6EFD] px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-blue-700"
                            >
                                <Printer size={17} />
                                Print
                            </a>
                        )}
                    </div>
                </div>

                <SlipNextStep slip={slip} />

                <IssuanceSlip slip={slip} className="rounded-2xl shadow-sm" />
            </div>
        </>
    );
}

function SlipNextStep({ slip }: { slip: IssuanceSlipData }) {
    switch (slip.status) {
        case 'placed':
            return (
                <Notice tone="amber" icon={<Clock size={20} />}>
                    The PROWARE office is preparing your order. Show this slip
                    there by{' '}
                    <strong>{formatDateOrdered(slip.pick_up_by)}</strong>, pay{' '}
                    <strong>{formatPeso(slip.total_centavos)}</strong>, and get
                    your items. You can show it on your phone or print it.
                </Notice>
            );
        case 'ready':
            return (
                <Notice tone="green" icon={<PackageCheck size={20} />}>
                    Your order is ready. Show this slip at the PROWARE office by{' '}
                    <strong>{formatDateOrdered(slip.pick_up_by)}</strong>, pay{' '}
                    <strong>{formatPeso(slip.total_centavos)}</strong>, and get
                    your items.
                </Notice>
            );
        case 'picked_up':
            return (
                <Notice tone="green" icon={<CheckCircle2 size={20} />}>
                    Released on{' '}
                    <strong>{formatDateOrdered(slip.released_on)}</strong>
                    {slip.issued_by && ` by ${slip.issued_by}`}. Keep this slip
                    as your receipt.
                </Notice>
            );
        default:
            return (
                <Notice tone="red" icon={<Ban size={20} />}>
                    This order was cancelled, so this slip can no longer be
                    used.
                </Notice>
            );
    }
}

function Notice({
    tone,
    icon,
    children,
}: {
    tone: 'amber' | 'green' | 'red';
    icon: ReactNode;
    children: ReactNode;
}) {
    return (
        <p
            className={cn(
                'mx-auto flex max-w-3xl gap-3 rounded-2xl border-l-4 px-4 py-3 text-sm leading-6',
                tone === 'amber' &&
                    'border-amber-500 bg-amber-50 text-amber-900',
                tone === 'green' &&
                    'border-emerald-500 bg-emerald-50 text-emerald-900',
                tone === 'red' && 'border-red-500 bg-red-50 text-red-900',
            )}
        >
            <span className="mt-0.5 shrink-0">{icon}</span>
            <span>{children}</span>
        </p>
    );
}
