import { Form } from '@inertiajs/react';
import { CalendarClock, LoaderCircle, X } from 'lucide-react';
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
};

/**
 * The pop-up where the Specialist moves the last day students can preorder
 * a product, e.g. to collect more preorders before ordering in the eStore.
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
                    <Form
                        {...PreorderController.updateCloseDate.form(product.id)}
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
                                                Preorders Close On
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

                                <div className="space-y-3 px-6 py-5">
                                    <label className="grid gap-1.5">
                                        <span className="text-sm font-black text-slate-700">
                                            Last day students can preorder
                                        </span>
                                        <input
                                            type="date"
                                            name="preorders_close_on"
                                            defaultValue={
                                                product.preorders_close_on ?? ''
                                            }
                                            min={today}
                                            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                        />
                                        <InputError
                                            message={errors.preorders_close_on}
                                        />
                                    </label>
                                    <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                                        Move it later to collect more preorders.
                                        Students can preorder until the end of
                                        that day.
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
