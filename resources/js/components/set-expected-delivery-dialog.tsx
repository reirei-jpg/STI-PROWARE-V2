import { Form } from '@inertiajs/react';
import { CalendarClock, LoaderCircle, X } from 'lucide-react';
import PurchaseOrderDeliveryController from '@/actions/App/Http/Controllers/PurchaseOrderDeliveryController';
import InputError from '@/components/input-error';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';

export type ExpectedDeliveryTarget = {
    id: number;
    order_number: string | null;
    expected_delivery_date: string | null;
    expected_delivery_note: string | null;
};

const inputClasses =
    'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100';

/**
 * The pop-up where the Specialist enters the date Head Office said an
 * order's items will arrive (and a short note about the call), or clears
 * it. PROWARE reminds her the day before and on the day.
 */
export default function SetExpectedDeliveryDialog({
    order,
    today,
    onClose,
}: {
    order: ExpectedDeliveryTarget | null;
    today: string;
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
                        {...PurchaseOrderDeliveryController.setExpectedDate.form(
                            order.id,
                        )}
                        options={{ preserveScroll: true }}
                        onSuccess={onClose}
                    >
                        {({ processing, errors }) => (
                            <>
                                <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                                    <div className="flex items-start gap-3">
                                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                                            <CalendarClock size={22} />
                                        </span>
                                        <div>
                                            <DialogTitle className="text-lg font-black text-slate-900">
                                                Expected Delivery
                                            </DialogTitle>
                                            <DialogDescription className="text-sm text-slate-500">
                                                {order.order_number
                                                    ? `Order #${order.order_number}`
                                                    : 'This order'}{' '}
                                                · the date Head Office said it
                                                will arrive
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
                                            Expected delivery date
                                        </span>
                                        <input
                                            type="date"
                                            name="expected_delivery_date"
                                            defaultValue={
                                                order.expected_delivery_date ??
                                                ''
                                            }
                                            min={today}
                                            className={inputClasses}
                                        />
                                        <InputError
                                            message={
                                                errors.expected_delivery_date
                                            }
                                        />
                                    </label>

                                    <label className="grid gap-1.5">
                                        <span className="text-sm font-black text-slate-700">
                                            Note (optional)
                                        </span>
                                        <input
                                            name="expected_delivery_note"
                                            defaultValue={
                                                order.expected_delivery_note ??
                                                ''
                                            }
                                            maxLength={200}
                                            placeholder="e.g. Sir Ernest called, 2 boxes"
                                            className={inputClasses}
                                        />
                                        <InputError
                                            message={
                                                errors.expected_delivery_note
                                            }
                                        />
                                    </label>

                                    <p className="rounded-xl bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-800">
                                        You will be reminded the day before and
                                        on the day, from 7:00 AM. Leave the date
                                        empty and save to clear it.
                                    </p>
                                </div>

                                <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
                                    <DialogClose className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50">
                                        Cancel
                                    </DialogClose>
                                    <button
                                        type="submit"
                                        disabled={processing}
                                        className="inline-flex items-center gap-2 rounded-xl bg-[#0D6EFD] px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:opacity-60"
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
                )}
            </DialogContent>
        </Dialog>
    );
}
