import { router } from '@inertiajs/react';
import { BellRing, LoaderCircle, X } from 'lucide-react';
import { useState } from 'react';
import PurchaseOrderReminderController from '@/actions/App/Http/Controllers/PurchaseOrderReminderController';
import InputError from '@/components/input-error';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { formatDateOrdered, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

export type ReminderOrder = {
    id: number;
    order_number: string | null;
    date_ordered: string;
    quantity_ordered: number;
    quantity_received: number;
    late_days: number;
    reminded_at: string | null;
    reminded_by: string | null;
    /** A late order not reminded about in the last week. */
    can_remind: boolean;
    /** When the next reminder may be sent, while waiting for it. */
    remind_again_on: string | null;
};

/**
 * The School Admin's ready-made reminder to the Specialist about a late
 * order: a button that shows the exact message before sending it, and
 * afterwards when it was sent and when it can be sent again (a week later).
 */
export default function RemindSpecialist({
    order,
    onSent,
    className,
}: {
    order: ReminderOrder;
    onSent?: () => void;
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const number = order.order_number
        ? `Order #${order.order_number}`
        : 'This order';
    const stillToCome = Math.max(
        0,
        order.quantity_ordered - order.quantity_received,
    );

    const send = () => {
        setSending(true);
        setError(null);
        router.post(
            PurchaseOrderReminderController.store(order.id).url,
            {},
            {
                preserveScroll: true,
                // Keeps an open details popup open; it reloads in onSent.
                preserveState: true,
                onSuccess: () => {
                    setOpen(false);
                    onSent?.();
                },
                onError: (errors) =>
                    setError(
                        errors.reminder ??
                            'The reminder could not be sent. Try again.',
                    ),
                onFinish: () => setSending(false),
            },
        );
    };

    return (
        <div className={cn('flex flex-col items-end gap-1.5', className)}>
            {order.can_remind && (
                <button
                    type="button"
                    onClick={() => {
                        setError(null);
                        setOpen(true);
                    }}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 text-sm font-black whitespace-nowrap text-red-700 transition hover:bg-red-100"
                >
                    <BellRing size={16} />
                    Remind Specialist
                </button>
            )}
            {order.reminded_at && (
                <p className="max-w-56 text-right text-xs text-slate-500">
                    Reminded {formatDateTime(order.reminded_at)}
                    {order.reminded_by && ` by ${order.reminded_by}`}
                    {order.remind_again_on &&
                        ` · can remind again ${formatDateOrdered(order.remind_again_on)}`}
                </p>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-lg [&>button:last-child]:hidden">
                    <div className="flex items-start justify-between gap-4 px-6 pt-5">
                        <div>
                            <DialogTitle className="text-lg font-black text-slate-900">
                                Remind the Specialist?
                            </DialogTitle>
                            <DialogDescription className="mt-1 text-sm text-slate-600">
                                This reminder is sent to the PROWARE Specialist
                                on the website and the phone app:
                            </DialogDescription>
                        </div>
                        <DialogClose className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                            <X size={20} />
                            <span className="sr-only">Close</span>
                        </DialogClose>
                    </div>

                    <div className="space-y-3 px-6 py-4">
                        <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800">
                            {number} is not complete after {order.late_days}{' '}
                            days (ordered{' '}
                            {formatDateOrdered(order.date_ordered)};{' '}
                            {stillToCome.toLocaleString('en-PH')} of{' '}
                            {order.quantity_ordered.toLocaleString('en-PH')}{' '}
                            still to come). Why is it not delivered yet?
                        </p>
                        <p className="text-xs text-slate-500">
                            The next reminder for this order can be sent a week
                            from today.
                        </p>
                        <InputError message={error ?? undefined} />
                    </div>

                    <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50/60 px-6 py-3">
                        <DialogClose className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50">
                            Cancel
                        </DialogClose>
                        <button
                            type="button"
                            onClick={send}
                            disabled={sending}
                            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-red-700 disabled:opacity-60"
                        >
                            {sending ? (
                                <LoaderCircle
                                    size={16}
                                    className="animate-spin"
                                />
                            ) : (
                                <BellRing size={16} />
                            )}
                            Send reminder
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
