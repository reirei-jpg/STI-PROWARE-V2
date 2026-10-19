import { useForm, useHttp, usePage } from '@inertiajs/react';
import { CalendarClock, LoaderCircle, Plus, X } from 'lucide-react';
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import StorefrontController from '@/actions/App/Http/Controllers/StorefrontController';
import StudentPreorderController from '@/actions/App/Http/Controllers/StudentPreorderController';
import InputError from '@/components/input-error';
import OptionRow from '@/components/option-row';
import QuantityInput from '@/components/quantity-input';
import { useSignInPrompt } from '@/components/sign-in-prompt';
import { PriceLines } from '@/components/storefront-tile';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { MAX_PER_ITEM } from '@/lib/number-input';
import { formatDateOrdered, formatPeso } from '@/lib/format';
import { pickChoice, pickedVariant, startingPicks } from '@/lib/option-picker';
import type { Picked } from '@/lib/option-picker';
import type {
    StorefrontProductDetails,
    StorefrontTileProduct,
    User,
} from '@/types';

const PreorderContext = createContext<(product: StorefrontTileProduct) => void>(
    () => {},
);

/**
 * The Preorder button's behaviour on the storefront: a signed-out visitor is
 * asked to sign in; a signed-in student gets the Preorder form. Wrap the
 * storefront in this provider (inside the sign-in prompt) and call
 * `usePreorder()` to start a preorder.
 */
export function PreorderProvider({ children }: { children: ReactNode }) {
    const { auth } = usePage<{ auth: { user: User | null } }>().props;
    const openSignIn = useSignInPrompt();
    const [product, setProduct] = useState<StorefrontTileProduct | null>(null);

    const start = (chosen: StorefrontTileProduct) => {
        if (auth.user === null) {
            openSignIn();

            return;
        }

        setProduct(chosen);
    };

    return (
        <PreorderContext.Provider value={start}>
            {children}
            <PreorderDialog
                product={product}
                isStudent={auth.user?.role === 'student'}
                onClose={() => setProduct(null)}
            />
        </PreorderContext.Provider>
    );
}

export function usePreorder(): (product: StorefrontTileProduct) => void {
    return useContext(PreorderContext);
}

/**
 * The Preorder form: which size or color and how many. A preorder is a
 * reservation (no payment) that tells the PROWARE office how many to order:
 * of a Coming Soon product, or of an item for sale that is out of stock
 * (only its sizes that can be preordered; the student is notified when it
 * is back in stock).
 */
function PreorderDialog({
    product,
    isStudent,
    onClose,
}: {
    product: StorefrontTileProduct | null;
    isStudent: boolean;
    onClose: () => void;
}) {
    const http = useHttp<Record<string, never>, StorefrontProductDetails>({});
    const [details, setDetails] = useState<StorefrontProductDetails | null>(
        null,
    );
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (product === null || !isStudent) {
            return;
        }

        setDetails(null);
        setFailed(false);

        void http
            .get(StorefrontController.show(product.id).url, {
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
        // Load once per opened product; `http` changes on every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [product?.id, isStudent]);

    return (
        <Dialog
            open={product !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-lg [&>button:last-child]:hidden">
                {product && (
                    <>
                        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                            <div className="flex items-start gap-3">
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                                    <CalendarClock size={22} />
                                </span>
                                <div>
                                    <DialogTitle className="text-lg font-black text-slate-900">
                                        Preorder
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

                        {!isStudent ? (
                            <p className="px-6 py-8 text-center text-sm leading-6 text-slate-600">
                                Preorders are for students. You are signed in
                                with a staff account.
                            </p>
                        ) : !product.accepts_preorders ? (
                            <p className="px-6 py-8 text-center text-sm leading-6 text-slate-600">
                                Preorders for this item are closed
                                {product.preorders_close_on &&
                                    ` (the last day was ${formatDateOrdered(product.preorders_close_on)})`}
                                .
                            </p>
                        ) : failed ? (
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
                            <PreorderForm details={details} onClose={onClose} />
                        )}
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

type PreorderLine = { product_variant_id: string; quantity: string };

/** "2 pcs", "1 pc". */
function piecesText(pieces: number): string {
    return `${pieces} ${pieces === 1 ? 'pc' : 'pcs'}`;
}

function PreorderForm({
    details,
    onClose,
}: {
    details: StorefrontProductDetails;
    onClose: () => void;
}) {
    // An item for sale that is out of stock: only its sizes that can be
    // preordered. A Coming Soon product: any size, nothing is in stock yet.
    const restock = details.status !== 'preorder';
    const canPreorder = (variant: { can_preorder: boolean }) =>
        !restock || variant.can_preorder;
    const [picked, setPicked] = useState<Picked>(() =>
        startingPicks(details.variants, canPreorder),
    );
    const [quantityText, setQuantityText] = useState('1');
    // The sizes added so far, like a cart: one Preorder button sends them all.
    const form = useForm<{ items: PreorderLine[] }>({ items: [] });
    const { data, setData, processing, errors } = form;
    const hasChoices = details.variants.length > 1;
    const quantity = Number(quantityText) || 0;
    const chosen = pickedVariant(details.variants, details.options, picked);
    const chosenId =
        chosen !== undefined && canPreorder(chosen) ? String(chosen.id) : '';
    const labelOf = (variantId: string) =>
        details.variants.find((variant) => String(variant.id) === variantId)
            ?.label ?? '';
    // With nothing added yet, Preorder sends the size chosen now.
    const lines: PreorderLine[] =
        data.items.length > 0
            ? data.items
            : chosenId !== '' && quantity >= 1
              ? [{ product_variant_id: chosenId, quantity: String(quantity) }]
              : [];
    const totalPieces = lines.reduce(
        (sum, line) => sum + (Number(line.quantity) || 0),
        0,
    );
    const chosenNotAdded =
        data.items.length > 0 &&
        chosenId !== '' &&
        !data.items.some((line) => line.product_variant_id === chosenId);
    const errorFor = (index: number) =>
        errors[`items.${index}.product_variant_id` as keyof typeof errors] ??
        errors[`items.${index}.quantity` as keyof typeof errors];
    const listErrors = lines
        .map((_, index) => errorFor(index))
        .filter((message) => message !== undefined);

    const addChosen = () => {
        if (chosenId === '' || quantity < 1) {
            return;
        }

        const existing = data.items.find(
            (line) => line.product_variant_id === chosenId,
        );

        setData(
            'items',
            existing
                ? data.items.map((line) =>
                      line === existing
                          ? {
                                ...line,
                                quantity: String(
                                    Math.min(
                                        MAX_PER_ITEM,
                                        (Number(line.quantity) || 0) + quantity,
                                    ),
                                ),
                            }
                          : line,
                  )
                : [
                      ...data.items,
                      {
                          product_variant_id: chosenId,
                          quantity: String(quantity),
                      },
                  ],
        );
        form.clearErrors();
        setPicked(startingPicks(details.variants, canPreorder));
        setQuantityText('1');
    };

    const changeLine = (variantId: string, value: string) =>
        setData(
            'items',
            data.items.map((line) =>
                line.product_variant_id === variantId
                    ? { ...line, quantity: value }
                    : line,
            ),
        );

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                form.transform(() => ({ items: lines }));
                form.post(StudentPreorderController.store(details.id).url, {
                    preserveScroll: true,
                    onSuccess: onClose,
                });
            }}
            className="flex min-h-0 flex-col"
        >
            <div className="space-y-5 overflow-y-auto px-6 py-5">
                <div className="flex gap-4">
                    {details.photo_url && (
                        <img
                            src={details.photo_url}
                            alt=""
                            className="h-20 w-20 shrink-0 rounded-xl object-cover"
                        />
                    )}
                    <div className="space-y-1">
                        <PriceLines price={details.price} />
                        {restock && (
                            <p className="text-xs font-bold text-red-600">
                                Out of stock
                            </p>
                        )}
                        {!restock && details.preorders_close_on && (
                            <p className="text-xs font-bold text-amber-700">
                                Preorders close{' '}
                                {formatDateOrdered(details.preorders_close_on)}
                            </p>
                        )}
                        {!restock && details.expected_arrival && (
                            <p className="text-xs font-semibold text-slate-600">
                                Expected to arrive {details.expected_arrival}
                            </p>
                        )}
                        {!restock && details.early_bird && (
                            <p className="text-xs font-black text-red-600">
                                {details.early_bird.pieces_left > 0
                                    ? `Early bird: ${formatPeso(details.early_bird.price_centavos)} each for the next ${details.early_bird.pieces_left} pcs preordered`
                                    : 'The early-bird pieces are all taken.'}
                            </p>
                        )}
                    </div>
                </div>

                {hasChoices &&
                    details.options.map((option) => (
                        <OptionRow
                            key={option.name}
                            option={option}
                            picked={picked}
                            variants={details.variants}
                            canPick={canPreorder}
                            tone="amber"
                            onPick={(choice) => {
                                const next = pickChoice(
                                    details.variants,
                                    details.options,
                                    picked,
                                    option.name,
                                    choice,
                                    canPreorder,
                                );

                                setPicked(next);
                            }}
                        />
                    ))}

                <section className="space-y-2">
                    <p className="text-sm font-black text-slate-700">
                        How many?
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                        <QuantityInput
                            value={quantityText}
                            onChange={setQuantityText}
                            label="How many"
                            tone="amber"
                        />
                        {hasChoices && (
                            <button
                                type="button"
                                onClick={addChosen}
                                disabled={chosenId === '' || quantity < 1}
                                className="inline-flex h-11 items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 text-sm font-black text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Plus size={16} />
                                Add to preorder
                            </button>
                        )}
                    </div>
                    {hasChoices && data.items.length === 0 && (
                        <p className="text-xs text-slate-500">
                            To preorder more than one size or color, choose one,
                            press Add to preorder, then choose the next.
                        </p>
                    )}
                </section>

                {data.items.length > 0 && (
                    <section className="space-y-2">
                        <p className="text-sm font-black text-slate-700">
                            Your preorder ({piecesText(totalPieces)})
                        </p>
                        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                            {data.items.map((line, index) => (
                                <li
                                    key={line.product_variant_id}
                                    className="space-y-1 px-3 py-2"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">
                                            {labelOf(line.product_variant_id)}
                                        </span>
                                        <QuantityInput
                                            value={line.quantity}
                                            onChange={(value) =>
                                                changeLine(
                                                    line.product_variant_id,
                                                    value,
                                                )
                                            }
                                            label={`How many ${labelOf(line.product_variant_id)}`}
                                            small
                                            tone="amber"
                                        />
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setData(
                                                    'items',
                                                    data.items.filter(
                                                        (other) =>
                                                            other !== line,
                                                    ),
                                                )
                                            }
                                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-bold text-red-700 transition hover:bg-red-100"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                    <InputError message={errorFor(index)} />
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {data.items.length === 0 &&
                    listErrors.map((message) => (
                        <InputError key={message} message={message} />
                    ))}
                <InputError message={errors.items} />

                <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
                    {restock
                        ? 'This item is out of stock. Preorder it: when it is back in stock, your pieces are held for you for 24 hours and you are notified. There is nothing to pay now. If you preorder the same size again, the new number replaces the old one.'
                        : 'A preorder reserves the item so the PROWARE office knows how many to order. There is nothing to pay now. If you preorder the same size again, the new number replaces the old one.'}
                </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
                {lines.length === 0 && (
                    <p className="mr-auto text-xs font-semibold text-slate-500">
                        Choose the{' '}
                        {details.options
                            .filter((option) => !picked[option.name])
                            .map((option) => option.name.toLowerCase())
                            .join(' and ') || 'size or color'}{' '}
                        first.
                    </p>
                )}
                {chosenNotAdded && (
                    <p className="mr-auto text-xs font-semibold text-amber-800">
                        {labelOf(chosenId)} is not in your preorder yet. Press
                        Add to preorder to include it.
                    </p>
                )}
                <DialogClose className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50">
                    Cancel
                </DialogClose>
                <button
                    type="submit"
                    disabled={
                        processing ||
                        lines.length === 0 ||
                        lines.some((line) => (Number(line.quantity) || 0) < 1)
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-black text-amber-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {processing ? (
                        <LoaderCircle size={17} className="animate-spin" />
                    ) : (
                        <CalendarClock size={17} />
                    )}
                    {data.items.length > 1
                        ? `Preorder ${piecesText(totalPieces)}`
                        : 'Preorder'}
                </button>
            </div>
        </form>
    );
}
