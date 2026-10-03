import { Form } from '@inertiajs/react';
import { LoaderCircle, X, XCircle } from 'lucide-react';
import OrderController from '@/actions/App/Http/Controllers/OrderController';
import InputError from '@/components/input-error';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { formatPeso } from '@/lib/format';
import type { OrderRow } from '@/types';

/**
 * The Specialist cancels a student's order with a reason the student will
 * see. Its items go back to stock.
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
            <DialogContent className="gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-md [&>button:last-child]:hidden">
                {order && (
                    <Form
                        {...OrderController.cancel.form(order.id)}
                        options={{ preserveScroll: true }}
                        onSuccess={onClose}
                    >
                        {({ processing, errors }) => (
                            <>
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
                                                {formatPeso(
                                                    order.total_centavos,
                                                )}
                                            </DialogDescription>
                                        </div>
                                    </div>
                                    <DialogClose className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                                        <X size={20} />
                                        <span className="sr-only">Close</span>
                                    </DialogClose>
                                </div>

                                <div className="space-y-3 px-6 py-5">
                                    <label className="grid gap-1.5">
                                        <span className="text-sm font-black text-slate-700">
                                            Reason
                                        </span>
                                        <textarea
                                            name="reason"
                                            rows={3}
                                            maxLength={200}
                                            placeholder="e.g. The size you ordered was damaged."
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                        />
                                        <InputError message={errors.reason} />
                                    </label>
                                    <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                                        The items go back to stock and the
                                        student is notified with this reason.
                                        This cannot be undone; the student can
                                        order again.
                                    </p>
                                </div>

                                <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
                                    <DialogClose className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50">
                                        Keep order
                                    </DialogClose>
                                    <button
                                        type="submit"
                                        disabled={processing}
                                        className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white transition hover:bg-red-700 disabled:opacity-60"
                                    >
                                        {processing && (
                                            <LoaderCircle
                                                size={17}
                                                className="animate-spin"
                                            />
                                        )}
                                        Cancel order
                                    </button>
                                </div>
                            </>
                        )}
                    </Form>
                )}
            </DialogContent>
        </Dialog>
    );
}
