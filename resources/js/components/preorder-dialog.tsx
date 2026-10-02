import { useForm, useHttp, usePage } from '@inertiajs/react';
import { CalendarClock, LoaderCircle, Minus, Plus, X } from 'lucide-react';
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import StorefrontController from '@/actions/App/Http/Controllers/StorefrontController';
import StudentPreorderController from '@/actions/App/Http/Controllers/StudentPreorderController';
import InputError from '@/components/input-error';
import { useSignInPrompt } from '@/components/sign-in-prompt';
import { PriceLines } from '@/components/storefront-tile';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { formatDateOrdered } from '@/lib/format';
import { cn } from '@/lib/utils';
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
 * reservation (no payment) that tells the PROWARE office how many to order.
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

function PreorderForm({
    details,
    onClose,
}: {
    details: StorefrontProductDetails;
    onClose: () => void;
}) {
    const form = useForm({
        product_variant_id:
            details.variants.length === 1 ? String(details.variants[0].id) : '',
        quantity: '1',
    });
    const { data, setData, processing, errors } = form;
    const hasChoices = details.variants.length > 1;
    const quantity = Number(data.quantity) || 0;

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
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
                        {details.preorders_close_on && (
                            <p className="text-xs font-bold text-amber-700">
                                Preorders close{' '}
                                {formatDateOrdered(details.preorders_close_on)}
                            </p>
                        )}
                    </div>
                </div>

                {hasChoices && (
                    <section className="space-y-2">
                        <p className="text-sm font-black text-slate-700">
                            {details.options
                                .map((option) => option.name)
                                .join(' · ') || 'Choose one'}
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {details.variants.map((variant) => (
                                <label
                                    key={variant.id}
                                    className={cn(
                                        'flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition',
                                        data.product_variant_id ===
                                            String(variant.id)
                                            ? 'border-amber-500 bg-amber-50 text-amber-900'
                                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                                    )}
                                >
                                    <input
                                        type="radio"
                                        name="product_variant_id"
                                        checked={
                                            data.product_variant_id ===
                                            String(variant.id)
                                        }
                                        onChange={() =>
                                            setData(
                                                'product_variant_id',
                                                String(variant.id),
                                            )
                                        }
                                        className="h-4 w-4 shrink-0 accent-amber-500"
                                    />
                                    {variant.label}
                                </label>
                            ))}
                        </div>
                        <InputError message={errors.product_variant_id} />
                    </section>
                )}

                <section className="space-y-2">
                    <p className="text-sm font-black text-slate-700">
                        How many?
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() =>
                                setData(
                                    'quantity',
                                    String(Math.max(1, quantity - 1)),
                                )
                            }
                            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
                            aria-label="One less"
                        >
                            <Minus size={16} />
                        </button>
                        <input
                            value={data.quantity}
                            onChange={(event) =>
                                setData(
                                    'quantity',
                                    event.target.value
                                        .replace(/\D/g, '')
                                        .slice(0, 4),
                                )
                            }
                            inputMode="numeric"
                            className="h-11 w-20 rounded-xl border border-slate-200 text-center text-sm font-black text-slate-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                            aria-label="How many"
                        />
                        <button
                            type="button"
                            onClick={() =>
                                setData('quantity', String(quantity + 1))
                            }
                            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
                            aria-label="One more"
                        >
                            <Plus size={16} />
                        </button>
                    </div>
                    <InputError message={errors.quantity} />
                </section>

                <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
                    A preorder reserves the item so the PROWARE office knows how
                    many to order. There is nothing to pay now. If you preorder
                    the same size again, the new number replaces the old one.
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
                        data.product_variant_id === '' ||
                        quantity < 1
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-black text-amber-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {processing ? (
                        <LoaderCircle size={17} className="animate-spin" />
                    ) : (
                        <CalendarClock size={17} />
                    )}
                    Preorder
                </button>
            </div>
        </form>
    );
}
