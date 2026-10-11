import { useForm } from '@inertiajs/react';
import { LoaderCircle, X, XCircle } from 'lucide-react';
import OrderController from '@/actions/App/Http/Controllers/OrderController';
import CancelReasonPicker from '@/components/cancel-reason-picker';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { STAFF_CANCEL_REASONS, cancelReasonReady } from '@/lib/cancel-reasons';
import { formatPeso } from '@/lib/format';
import type { OrderRow } from '@/types';

/**
 * The Specialist cancels a student's order, picking why from a list like in
 * online shops (Other asks to write why). The student sees the reason. Its
 * items are free to sell again.
 */
export default function CancelOrderDialog({
    order,
    onClose,
}: {
    order: OrderRow | null;
    onClose: () => void;
}) {
    return (
        <Dialog
            open={order !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-md [&>button:last-child]:hidden">
                {order && (
                    <CancelForm
                        key={order.id}
                        order={order}
                        onClose={onClose}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

function CancelForm({
    order,
    onClose,
}: {
    order: OrderRow;
    onClose: () => void;
}) {
    const form = useForm({ reason: '', note: '' });

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                form.post(OrderController.cancel(order.id).url, {
                    preserveScroll: true,
                    onSuccess: onClose,
                });
            }}
            className="flex min-h-0 flex-col"
        >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700">
                        <XCircle size={22} />
                    </span>
                    <div>
                        <DialogTitle className="text-lg font-black text-slate-900">
                            Cancel order {order.number}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-slate-500">
                            {order.student_name} ·{' '}
                            {formatPeso(order.total_centavos)}
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
                    Why is it cancelled?
                </p>
                <CancelReasonPicker
                    reasons={STAFF_CANCEL_REASONS}
                    reason={form.data.reason}
                    note={form.data.note}
                    onReason={(value) => form.setData('reason', value)}
                    onNote={(value) => form.setData('note', value)}
                    errors={form.errors}
                    notePlaceholder="e.g. The student changed course and needs another uniform."
                />
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                    The items go back on sale and the student is notified with
                    this reason. This cannot be undone; the student can order
                    again.
                </p>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
                <DialogClose className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50">
                    Keep order
                </DialogClose>
                <button
                    type="submit"
                    disabled={
                        form.processing ||
                        !cancelReasonReady(form.data.reason, form.data.note)
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {form.processing && (
                        <LoaderCircle size={17} className="animate-spin" />
                    )}
                    Cancel order
                </button>
            </div>
        </form>
    );
}
