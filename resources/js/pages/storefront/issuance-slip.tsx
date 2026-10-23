import { Head, Link, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    Ban,
    CheckCircle2,
    Clock,
    LoaderCircle,
    PackageCheck,
    Printer,
    X,
    XCircle,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import StudentOrderController from '@/actions/App/Http/Controllers/StudentOrderController';
import CancelReasonPicker from '@/components/cancel-reason-picker';
import IssuanceSlip from '@/components/issuance-slip';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    STUDENT_CANCEL_REASONS,
    cancelReasonReady,
} from '@/lib/cancel-reasons';
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
 * Cancel while the office has not prepared the order yet: Cancel order
 * opens a pop-up to pick why, like in online shops (Other asks to write
 * why), so the PROWARE office knows.
 */
function CancelOrder({ slip }: { slip: IssuanceSlipData }) {
    const [open, setOpen] = useState(false);
    const form = useForm({ reason: '', note: '' });

    const close = () => {
        setOpen(false);
        form.reset();
        form.clearErrors();
    };

    return (
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-sm text-slate-600">
                Changed your mind? You can cancel while the office has not
                prepared it yet.
            </p>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-black text-red-700 shadow-sm transition hover:bg-red-100"
            >
                <XCircle size={16} />
                Cancel order
            </button>

            <Dialog open={open} onOpenChange={(isOpen) => !isOpen && close()}>
                <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-md [&>button:last-child]:hidden">
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            form.post(
                                StudentOrderController.cancel(slip.order_id)
                                    .url,
                                { preserveScroll: true, onSuccess: close },
                            );
                        }}
                        className="flex min-h-0 flex-col"
                    >
                        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                            <div className="flex items-start gap-3">
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700">
                                    <Ban size={22} />
                                </span>
                                <div>
                                    <DialogTitle className="text-lg font-black text-slate-900">
                                        Cancel order {slip.number}?
                                    </DialogTitle>
                                    <DialogDescription className="text-sm text-slate-500">
                                        {formatPeso(slip.total_centavos)} · the
                                        items go back on sale
                                    </DialogDescription>
                                </div>
                            </div>
                            <DialogClose className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                                <X size={20} />
                                <span className="sr-only">Close</span>
                            </DialogClose>
                        </div>

                        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
                            <p className="text-sm font-black text-slate-700">
                                Why are you cancelling?
                            </p>
                            <CancelReasonPicker
                                reasons={STUDENT_CANCEL_REASONS}
                                reason={form.data.reason}
                                note={form.data.note}
                                onReason={(value) =>
                                    form.setData('reason', value)
                                }
                                onNote={(value) => form.setData('note', value)}
                                errors={form.errors}
                                notePlaceholder="e.g. I will order together with my classmates instead."
                            />
                        </div>

                        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
                            <DialogClose className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50">
                                Keep order
                            </DialogClose>
                            <button
                                type="submit"
                                disabled={
                                    form.processing ||
                                    !cancelReasonReady(
                                        form.data.reason,
                                        form.data.note,
                                    )
                                }
                                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {form.processing && (
                                    <LoaderCircle
                                        size={17}
                                        className="animate-spin"
                                    />
                                )}
                                Cancel order
                            </button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function SlipNextStep({ slip }: { slip: IssuanceSlipData }) {
    switch (slip.status) {
        case 'placed':
            return (
                <Notice tone="amber" icon={<Clock size={20} />}>
                    The PROWARE office is preparing your order. Pay{' '}
                    <strong>{formatPeso(slip.total_centavos)}</strong> at the
                    cashier, then show the receipt and this slip at the PROWARE
                    office by{' '}
                    <strong>{formatDateOrdered(slip.pick_up_by)}</strong> to get
                    your items. You can show the slip on your phone or print it.
                </Notice>
            );
        case 'ready':
            return (
                <Notice tone="green" icon={<PackageCheck size={20} />}>
                    Your order is ready. Pay{' '}
                    <strong>{formatPeso(slip.total_centavos)}</strong> at the
                    cashier, then show the receipt and this slip at the PROWARE
                    office by{' '}
                    <strong>{formatDateOrdered(slip.pick_up_by)}</strong> to get
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
