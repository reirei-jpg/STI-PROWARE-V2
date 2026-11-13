import { Form } from '@inertiajs/react';
import { CalendarClock, LoaderCircle, X } from 'lucide-react';
import { useState } from 'react';
import PreorderController from '@/actions/App/Http/Controllers/PreorderController';
import InputError from '@/components/input-error';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';

export type CloseDateTarget = {
    id: number;
    name: string;
    preorders_close_on: string | null;
    /** The first day buyers can pay; null until the payment dates are set. */
    preorder_pay_from?: string | null;
};

/**
 * The pop-up where the Specialist sets the payment dates of an item's
 * preorders: the first day buyers can pay, and the close date (the last day
 * to pay and to preorder). Buyers with unpaid preorders are told; those not
 * paid by the close date are dropped.
 */
export default function PreorderCloseDateDialog({
    product,
    today,
    onClose,
}: {
    product: CloseDateTarget | null;
    today: string;
    onClose: () => void;
}) {
    return (
        <Dialog
            open={product !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent className="gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-md [&>button:last-child]:hidden">
                {product && (
                    <PaymentDatesForm
                        key={product.id}
                        product={product}
                        today={today}
                        onClose={onClose}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

const dateInputClasses =
    'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 aria-invalid:border-red-400 aria-invalid:ring-2 aria-invalid:ring-red-100';

/**
 * The two dates, checked as they are typed: a day that has passed, or a
 * close date before the start date, is refused at once, not only after
 * Save.
 */
function PaymentDatesForm({
    product,
    today,
    onClose,
}: {
    product: CloseDateTarget;
    today: string;
    onClose: () => void;
}) {
    const [payFrom, setPayFrom] = useState(product.preorder_pay_from ?? today);
    const [closeOn, setCloseOn] = useState(product.preorders_close_on ?? '');
    const fromProblem =
        payFrom === ''
            ? 'Choose the first day buyers can pay.'
            : payFrom < today
              ? 'The start date cannot be in the past.'
              : null;
    const closeProblem =
        closeOn === ''
            ? 'Choose the last day to pay.'
            : closeOn < payFrom
              ? 'The close date cannot be before the start date.'
              : null;

    return (
        <Form
            {...PreorderController.updatePaymentDates.form(product.id)}
            options={{ preserveScroll: true }}
            onSuccess={onClose}
        >
            {({ processing, errors }) => (
                <>
                    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                        <div className="flex items-start gap-3">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                                <CalendarClock size={22} />
                            </span>
                            <div>
                                <DialogTitle className="text-lg font-black text-slate-900">
                                    Payment Dates
                                </DialogTitle>
                                <DialogDescription className="text-sm text-slate-500">
                                    {product.name}
                                </DialogDescription>
                            </div>
                        </div>
                        <DialogClose className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                            <X size={20} />
                            <span className="sr-only">Close</span>
                        </DialogClose>
                    </div>

                    <div className="space-y-4 px-6 py-5">
                        <label className="grid gap-1.5">
                            <span className="text-sm font-black text-slate-700">
                                Start date (buyers can pay from)
                            </span>
                            <input
                                type="date"
                                name="preorder_pay_from"
                                value={payFrom}
                                onChange={(event) =>
                                    setPayFrom(event.target.value)
                                }
                                min={today}
                                aria-invalid={
                                    fromProblem !== null ||
                                    Boolean(errors.preorder_pay_from)
                                }
                                className={dateInputClasses}
                            />
                            <InputError
                                message={
                                    fromProblem ?? errors.preorder_pay_from
                                }
                            />
                        </label>
                        <label className="grid gap-1.5">
                            <span className="text-sm font-black text-slate-700">
                                Close date (last day to pay and to preorder)
                            </span>
                            <input
                                type="date"
                                name="preorders_close_on"
                                value={closeOn}
                                onChange={(event) =>
                                    setCloseOn(event.target.value)
                                }
                                min={payFrom || today}
                                aria-invalid={
                                    closeProblem !== null ||
                                    Boolean(errors.preorders_close_on)
                                }
                                className={dateInputClasses}
                            />
                            <InputError
                                message={
                                    closeProblem ?? errors.preorders_close_on
                                }
                            />
                        </label>
                        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                            Buyers with unpaid preorders are told to pay at the
                            cashier between these dates. Preorders not paid by
                            the end of the close date are dropped.
                        </p>
                    </div>

                    <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
                        <DialogClose className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50">
                            Cancel
                        </DialogClose>
                        <button
                            type="submit"
                            disabled={
                                processing ||
                                fromProblem !== null ||
                                closeProblem !== null
                            }
                            className="inline-flex items-center gap-2 rounded-xl bg-[#0D6EFD] px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {processing && (
                                <LoaderCircle
                                    size={17}
                                    className="animate-spin"
                                />
                            )}
                            Save
                        </button>
                    </div>
                </>
            )}
        </Form>
    );
}
