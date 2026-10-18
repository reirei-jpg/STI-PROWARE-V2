import { Form } from '@inertiajs/react';
import { LoaderCircle, PackageX, X } from 'lucide-react';
import { useState } from 'react';
import PreorderRestockController from '@/actions/App/Http/Controllers/PreorderRestockController';
import InputError from '@/components/input-error';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';

export type NotRestockedTarget = {
    variantId: number;
    /** "BSIT Polo (XS)" */
    name: string;
    students: number;
};

const REASON_MAX = 200;

/**
 * The pop-up where the Specialist says a sold-out size will not be
 * restocked: every preorder waiting for it is closed and each student is
 * notified, with her reason if she writes one.
 */
export default function NotRestockedDialog({
    target,
    onClose,
    onDone,
}: {
    target: NotRestockedTarget | null;
    onClose: () => void;
    onDone: () => void;
}) {
    return (
        <Dialog
            open={target !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent className="gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-md [&>button:last-child]:hidden">
                {target && (
                    <NotRestockedForm
                        key={target.variantId}
                        target={target}
                        onDone={onDone}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

function NotRestockedForm({
    target,
    onDone,
}: {
    target: NotRestockedTarget;
    onDone: () => void;
}) {
    const [reason, setReason] = useState('');

    return (
        <Form
            {...PreorderRestockController.store.form(target.variantId)}
            options={{ preserveScroll: true }}
            onSuccess={onDone}
        >
            {({ processing, errors }) => (
                <>
                    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                        <div className="flex items-start gap-3">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700">
                                <PackageX size={22} />
                            </span>
                            <div>
                                <DialogTitle className="text-lg font-black text-slate-900">
                                    Won't Be Restocked
                                </DialogTitle>
                                <DialogDescription className="text-sm text-slate-500">
                                    {target.name}
                                </DialogDescription>
                            </div>
                        </div>
                        <DialogClose className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                            <X size={20} />
                            <span className="sr-only">Close</span>
                        </DialogClose>
                    </div>

                    <div className="space-y-3 px-6 py-5">
                        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm leading-6 text-red-900">
                            {target.students === 0
                                ? 'No student is waiting for it. '
                                : `${target.students} ${target.students === 1 ? 'student is' : 'students are'} waiting for it. Every preorder will be closed and each student will be notified. `}
                            Students will no longer be able to preorder it while
                            it is out of stock.
                        </p>
                        <label className="grid gap-1.5">
                            <span className="text-sm font-black text-slate-700">
                                Reason the students see{' '}
                                <span className="font-semibold text-slate-400">
                                    (optional)
                                </span>
                            </span>
                            <textarea
                                name="reason"
                                value={reason}
                                onChange={(event) =>
                                    setReason(
                                        event.target.value.slice(0, REASON_MAX),
                                    )
                                }
                                maxLength={REASON_MAX}
                                rows={3}
                                placeholder="e.g. Head Office no longer makes this size."
                                aria-invalid={Boolean(errors.reason)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 aria-invalid:border-red-400 aria-invalid:ring-2 aria-invalid:ring-red-100"
                            />
                            <span className="text-right text-xs text-slate-400">
                                {reason.length} of {REASON_MAX} characters
                            </span>
                            <InputError message={errors.reason} />
                        </label>
                    </div>

                    <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
                        <DialogClose className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50">
                            Keep waiting
                        </DialogClose>
                        <button
                            type="submit"
                            disabled={processing}
                            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {processing && (
                                <LoaderCircle
                                    size={17}
                                    className="animate-spin"
                                />
                            )}
                            Mark as not restocked
                        </button>
                    </div>
                </>
            )}
        </Form>
    );
}
