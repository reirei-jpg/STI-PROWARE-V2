import { useForm, useHttp } from '@inertiajs/react';
import { LoaderCircle, Pencil, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import StorefrontController from '@/actions/App/Http/Controllers/StorefrontController';
import StudentPreorderController from '@/actions/App/Http/Controllers/StudentPreorderController';
import ConfirmDialog from '@/components/confirm-dialog';
import InputError from '@/components/input-error';
import OptionRow from '@/components/option-row';
import QuantityInput from '@/components/quantity-input';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { MAX_PER_ITEM } from '@/lib/number-input';
import { pickChoice, pickedVariant } from '@/lib/option-picker';
import type { Picked } from '@/lib/option-picker';
import { formatUnits } from '@/lib/units';
import type { StorefrontProductDetails } from '@/types';

/** The waiting preorder being changed. */
export type EditablePreorder = {
    id: number;
    product_id: number;
    product_variant_id: number;
    product_name: string;
    variant_label: string | null;
    quantity: number;
};

/**
 * Change a waiting preorder: another size or color of the same item (one
 * that can be preordered) and how many. Lowering the quantity keeps its
 * place in line; raising it or changing the size or color moves it to the
 * end of the line, so the buyer is asked first.
 */
export default function EditPreorderDialog({
    preorder,
    onClose,
}: {
    preorder: EditablePreorder | null;
    onClose: () => void;
}) {
    const http = useHttp<Record<string, never>, StorefrontProductDetails>({});
    const [details, setDetails] = useState<StorefrontProductDetails | null>(
        null,
    );
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (preorder === null) {
            return;
        }

        setDetails(null);
        setFailed(false);

        void http
            .get(StorefrontController.show(preorder.product_id).url, {
                onSuccess: (response) => setDetails(response),
                onHttpException: () => {
                    setFailed(true);

                    return false;
                },
                onNetworkError: () => {
                    setFailed(true);

                    return false;
                },
            })
            .catch(() => setFailed(true));
        // Load once per opened preorder; `http` changes on every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [preorder?.id]);

    return (
        <Dialog
            open={preorder !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-lg [&>button:last-child]:hidden">
                {preorder && (
                    <>
                        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                            <div className="flex items-start gap-3">
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                                    <Pencil size={20} />
                                </span>
                                <div>
                                    <DialogTitle className="text-lg font-black text-slate-900">
                                        Change preorder
                                    </DialogTitle>
                                    <DialogDescription className="text-sm text-slate-500">
                                        {preorder.product_name}
                                    </DialogDescription>
                                </div>
                            </div>
                            <DialogClose className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                                <X size={20} />
                                <span className="sr-only">Close</span>
                            </DialogClose>
                        </div>

                        {failed ? (
                            <p className="px-6 py-8 text-center text-sm text-slate-500">
                                The item could not be loaded. Close this and try
                                again.
                            </p>
                        ) : details === null ? (
                            <p className="flex items-center justify-center gap-2 px-6 py-10 text-sm text-slate-500">
                                <LoaderCircle
                                    size={18}
                                    className="animate-spin"
                                />
                                Loading...
                            </p>
                        ) : (
                            <EditForm
                                key={preorder.id}
                                preorder={preorder}
                                details={details}
                                onClose={onClose}
                            />
                        )}
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

function EditForm({
    preorder,
    details,
    onClose,
}: {
    preorder: EditablePreorder;
    details: StorefrontProductDetails;
    onClose: () => void;
}) {
    const restock = details.status !== 'preorder';
    const limit = details.most_per_item ?? MAX_PER_ITEM;
    // Its own size can always stay; another one only when it can be preordered.
    const canPick = (variant: { id: number; can_preorder: boolean }) =>
        !restock ||
        variant.can_preorder ||
        variant.id === preorder.product_variant_id;
    const [picked, setPicked] = useState<Picked>(() => ({
        ...details.variants.find(
            (variant) => variant.id === preorder.product_variant_id,
        )?.choices,
    }));
    const [quantityText, setQuantityText] = useState(String(preorder.quantity));
    const [confirming, setConfirming] = useState(false);
    const form = useForm({ product_variant_id: 0, quantity: 0 });
    const errors = form.errors as Record<string, string | undefined>;

    const chosen = pickedVariant(details.variants, details.options, picked);
    const variantId =
        chosen !== undefined && canPick(chosen) ? chosen.id : null;
    const quantity = Number(quantityText) || 0;
    const changed =
        variantId !== null &&
        (variantId !== preorder.product_variant_id ||
            quantity !== preorder.quantity);
    const movesToEnd =
        variantId !== null &&
        (variantId !== preorder.product_variant_id ||
            quantity > preorder.quantity);
    const canSave =
        !form.processing && changed && quantity >= 1 && quantity <= limit;

    const send = () => {
        if (variantId === null) {
            return;
        }

        form.transform(() => ({ product_variant_id: variantId, quantity }));
        form.patch(StudentPreorderController.update(preorder.id).url, {
            preserveScroll: true,
            onSuccess: onClose,
            onFinish: () => setConfirming(false),
        });
    };

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();

                if (!canSave) {
                    return;
                }

                if (movesToEnd) {
                    setConfirming(true);

                    return;
                }

                send();
            }}
            className="flex min-h-0 flex-col"
        >
            <div className="space-y-5 overflow-y-auto px-6 py-5">
                <p className="text-sm text-slate-600">
                    Now:{' '}
                    <span className="font-black text-slate-900">
                        {preorder.variant_label
                            ? `${preorder.variant_label} · `
                            : ''}
                        {formatUnits(preorder.quantity, 'Piece')}
                    </span>
                </p>

                {details.variants.length > 1 &&
                    details.options.map((option) => (
                        <OptionRow
                            key={option.name}
                            option={option}
                            picked={picked}
                            variants={details.variants}
                            canPick={canPick}
                            tone="amber"
                            onPick={(choice) =>
                                setPicked(
                                    pickChoice(
                                        details.variants,
                                        details.options,
                                        picked,
                                        option.name,
                                        choice,
                                        canPick,
                                    ),
                                )
                            }
                        />
                    ))}

                <section className="space-y-2">
                    <p className="text-sm font-black text-slate-700">
                        How many?
                    </p>
                    <QuantityInput
                        value={quantityText}
                        onChange={setQuantityText}
                        label="How many"
                        tone="amber"
                        most={limit}
                    />
                </section>

                <InputError
                    message={
                        errors.preorder ??
                        errors.product_variant_id ??
                        errors.quantity
                    }
                />

                <p className="rounded-xl bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-900">
                    {changed && movesToEnd
                        ? 'A bigger quantity or another size or color moves your preorder to the end of the line, behind everyone already waiting.'
                        : 'Only lowering the quantity keeps your place in line. A bigger quantity or another size or color moves it to the end of the line.'}
                </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
                {variantId === null && (
                    <p className="mr-auto text-xs font-semibold text-slate-500">
                        Choose the size or color first.
                    </p>
                )}
                <DialogClose className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50">
                    Cancel
                </DialogClose>
                <button
                    type="submit"
                    disabled={!canSave}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#0D6EFD] px-5 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {form.processing ? (
                        <LoaderCircle size={17} className="animate-spin" />
                    ) : (
                        <Pencil size={17} />
                    )}
                    Save changes
                </button>
            </div>

            {/* Losing its place cannot be undone, so the buyer answers first. */}
            <ConfirmDialog
                open={confirming}
                title="Move to the end of the line?"
                description={`${formatUnits(quantity, 'Piece')} of ${chosen?.label || preorder.product_name}: your preorder moves to the end of the line, behind everyone already waiting. Early-bird pieces you already have stay with it. This cannot be undone.`}
                cancelLabel="Keep as it is"
                confirmLabel="Change"
                busy={form.processing}
                onConfirm={send}
                onClose={() => setConfirming(false)}
            />
        </form>
    );
}
