import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    Ban,
    CheckCircle2,
    Clock,
    LoaderCircle,
    PackageCheck,
    Printer,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import StudentOrderController from '@/actions/App/Http/Controllers/StudentOrderController';
import IssuanceSlip from '@/components/issuance-slip';
import { formatDateOrdered, formatPeso } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { IssuanceSlipData } from '@/types';

/**
 * The order's own page, opened from My Orders or right after Place Order:
 * its issuance slip to show (on the phone or printed) at the PROWARE
 * office, where the Specialist scans its QR, the student pays, and the
 * items are released. Above it, what to do next in V1's colors: amber
 * waiting, green ready or released, red cancelled. Below it, Cancel while
 * the office has not prepared the order yet.
 */
export default function StudentIssuanceSlip({
    slip,
    canCancel,
}: {
    slip: IssuanceSlipData;
    /** True while the office has not prepared the order yet. */
    canCancel: boolean;
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

                {canCancel && <CancelOrder slip={slip} />}
            </div>
        </>
    );
}

/**
 * Cancel while the office has not prepared the order yet, after a
 * "Cancel this order?" question, like My Orders had.
 */
function CancelOrder({ slip }: { slip: IssuanceSlipData }) {
    const [confirming, setConfirming] = useState(false);
    const [cancelling, setCancelling] = useState(false);

    const cancel = () => {
        setCancelling(true);
        router.post(
            StudentOrderController.cancel(slip.order_id).url,
            {},
            {
                preserveScroll: true,
                onFinish: () => {
                    setCancelling(false);
                    setConfirming(false);
                },
            },
        );
    };

    return (
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-sm text-slate-600">
                Changed your mind? You can cancel while the office has not
                prepared it yet.
            </p>
            {confirming ? (
                <div className="flex items-center gap-2 text-sm">
                    <span className="font-bold text-slate-700">
                        Cancel this order?
                    </span>
                    <button
                        type="button"
                        onClick={() => setConfirming(false)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 font-black text-slate-700 hover:bg-slate-50"
                    >
                        Keep it
                    </button>
                    <button
                        type="button"
                        onClick={cancel}
                        disabled={cancelling}
                        className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 font-black text-white hover:bg-red-700 disabled:opacity-60"
                    >
                        {cancelling && (
                            <LoaderCircle size={14} className="animate-spin" />
                        )}
                        Cancel order
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setConfirming(true)}
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-black text-red-700 hover:bg-red-100"
                >
                    Cancel order
                </button>
            )}
        </div>
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
