import { useForm, useHttp, usePage } from '@inertiajs/react';
import { LoaderCircle, Minus, Plus, ShoppingCart, X } from 'lucide-react';
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import CartController from '@/actions/App/Http/Controllers/CartController';
import StorefrontController from '@/actions/App/Http/Controllers/StorefrontController';
import InputError from '@/components/input-error';
import { useSignInPrompt } from '@/components/sign-in-prompt';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { formatPeso } from '@/lib/format';
import { formatUnits, unitWord } from '@/lib/units';
import { cn } from '@/lib/utils';
import type {
    StorefrontProductDetails,
    StorefrontTileProduct,
    User,
} from '@/types';

const AddToCartContext = createContext<
    (product: StorefrontTileProduct) => void
>(() => {});

/**
 * The Add to Cart button's behaviour on the storefront: a signed-out visitor
 * is asked to sign in; a signed-in student gets the picker. Wrap the
 * storefront in this provider (inside the sign-in prompt) and call
 * `useAddToCart()` to open it.
 */
export function AddToCartProvider({ children }: { children: ReactNode }) {
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
        <AddToCartContext.Provider value={start}>
            {children}
            <AddToCartDialog
                product={product}
                isStudent={auth.user?.role === 'student'}
                onClose={() => setProduct(null)}
            />
        </AddToCartContext.Provider>
    );
}

export function useAddToCart(): (product: StorefrontTileProduct) => void {
    return useContext(AddToCartContext);
}

/**
 * The picker (TikTok Shop style): size or color, by the piece or by a pack,
 * and how many, up to what is in stock.
 */
function AddToCartDialog({
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
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                                    <ShoppingCart size={22} />
                                </span>
                                <div>
                                    <DialogTitle className="text-lg font-black text-slate-900">
                                        Add to Cart
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
                                Buying is for students. You are signed in with a
                                staff account.
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
                            <PickerForm details={details} onClose={onClose} />
                        )}
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

/** '' = by the piece, otherwise the pack's id. */
type UnitChoice = string;

function PickerForm({
    details,
    onClose,
}: {
    details: StorefrontProductDetails;
    onClose: () => void;
}) {
    const firstInStock = details.variants.find(
        (variant) => variant.stock_pieces > 0,
    );
    const soldByPiece = details.variants.some(
        (variant) => variant.buy_price_centavos !== null,
    );
    const form = useForm({
        product_variant_id:
            details.variants.length === 1 && firstInStock
                ? String(firstInStock.id)
                : '',
        product_pack_id: (soldByPiece
            ? ''
            : String(details.buy_packs[0]?.id ?? '')) as UnitChoice,
        quantity: '1',
    });
    const { data, setData, processing, errors } = form;

    const variant = details.variants.find(
        (item) => String(item.id) === data.product_variant_id,
    );
    const pack = details.buy_packs.find(
        (item) => String(item.id) === data.product_pack_id,
    );
    const piecesPerUnit = pack?.pieces ?? 1;
    const unitName = pack?.name ?? 'Piece';
    const unitPrice = pack ? pack.price_centavos : variant?.buy_price_centavos;
    const most = variant
        ? Math.min(1000, Math.floor(variant.stock_pieces / piecesPerUnit))
        : 0;
    const quantity = Number(data.quantity) || 0;
    const hasChoices = details.variants.length > 1;
    const unitChoices = (soldByPiece ? 1 : 0) + details.buy_packs.length;

    const setQuantity = (value: number) =>
        setData('quantity', String(Math.max(1, Math.min(value, most || 1))));

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                form.post(CartController.store(details.id).url, {
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
                        <p
                            className={cn(
                                'text-2xl font-black',
                                details.status === 'on_sale'
                                    ? 'text-red-600'
                                    : 'text-blue-700',
                            )}
                        >
                            {unitPrice !== undefined && unitPrice !== null
                                ? formatPeso(unitPrice)
                                : 'Choose below'}
                            {unitPrice !== undefined && unitPrice !== null && (
                                <span className="ml-1 text-xs font-normal text-slate-500">
                                    /{' '}
                                    {pack
                                        ? `${pack.name} of ${pack.pieces}`
                                        : 'pc'}
                                </span>
                            )}
                        </p>
                        {variant && (
                            <p className="text-xs font-bold text-slate-500">
                                {variant.stock_pieces === 0
                                    ? 'Out of stock'
                                    : variant.pieces_left !== null
                                      ? `Only ${formatUnits(variant.pieces_left, 'Piece')} left`
                                      : 'In stock'}
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
                        <div className="flex flex-wrap gap-2">
                            {details.variants.map((item) => {
                                const soldOut = item.stock_pieces === 0;
                                const chosen =
                                    data.product_variant_id === String(item.id);

                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        disabled={soldOut}
                                        onClick={() => {
                                            setData(
                                                'product_variant_id',
                                                String(item.id),
                                            );
                                            setData('quantity', '1');
                                        }}
                                        className={cn(
                                            'rounded-xl border px-3 py-2 text-sm font-bold transition',
                                            chosen
                                                ? 'border-[#0D6EFD] bg-blue-50 text-blue-800'
                                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                                            soldOut &&
                                                'cursor-not-allowed border-dashed bg-slate-50 text-slate-400 line-through hover:border-slate-200',
                                        )}
                                        title={
                                            soldOut ? 'Out of stock' : undefined
                                        }
                                    >
                                        {item.label}
                                    </button>
                                );
                            })}
                        </div>
                        <InputError message={errors.product_variant_id} />
                    </section>
                )}

                {unitChoices > 1 && (
                    <section className="space-y-2">
                        <p className="text-sm font-black text-slate-700">
                            Buy by
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {soldByPiece && (
                                <UnitChip
                                    chosen={data.product_pack_id === ''}
                                    disabled={
                                        variant !== undefined &&
                                        variant.buy_price_centavos === null
                                    }
                                    onClick={() => {
                                        setData('product_pack_id', '');
                                        setData('quantity', '1');
                                    }}
                                    label="Piece"
                                    price={variant?.buy_price_centavos ?? null}
                                />
                            )}
                            {details.buy_packs.map((item) => (
                                <UnitChip
                                    key={item.id}
                                    chosen={
                                        data.product_pack_id === String(item.id)
                                    }
                                    disabled={
                                        variant !== undefined &&
                                        variant.stock_pieces < item.pieces
                                    }
                                    onClick={() => {
                                        setData(
                                            'product_pack_id',
                                            String(item.id),
                                        );
                                        setData('quantity', '1');
                                    }}
                                    label={`${item.name} of ${item.pieces}`}
                                    price={item.price_centavos}
                                />
                            ))}
                        </div>
                        <InputError message={errors.product_pack_id} />
                    </section>
                )}

                <section className="space-y-2">
                    <p className="text-sm font-black text-slate-700">
                        How many?
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setQuantity(quantity - 1)}
                            disabled={quantity <= 1}
                            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
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
                            onBlur={() => setQuantity(quantity)}
                            inputMode="numeric"
                            className="h-11 w-20 rounded-xl border border-slate-200 text-center text-sm font-black text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            aria-label="How many"
                        />
                        <button
                            type="button"
                            onClick={() => setQuantity(quantity + 1)}
                            disabled={variant === undefined || quantity >= most}
                            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                            aria-label="One more"
                        >
                            <Plus size={16} />
                        </button>
                        <span className="text-sm text-slate-500">
                            {unitWord(quantity, unitName)}
                            {piecesPerUnit > 1 &&
                                ` (${formatUnits(quantity * piecesPerUnit, 'Piece')})`}
                        </span>
                    </div>
                    {variant && quantity > most && most > 0 && (
                        <p className="text-sm text-red-600">
                            Only {formatUnits(most, unitName)} can be added.
                        </p>
                    )}
                    <InputError message={errors.quantity} />
                </section>

                {unitPrice !== undefined &&
                    unitPrice !== null &&
                    quantity > 0 && (
                        <p className="flex items-baseline justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm">
                            <span className="font-bold text-slate-600">
                                Subtotal
                            </span>
                            <span className="text-lg font-black text-slate-900">
                                {formatPeso(unitPrice * quantity)}
                            </span>
                        </p>
                    )}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
                <DialogClose className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50">
                    Cancel
                </DialogClose>
                <button
                    type="submit"
                    disabled={
                        processing ||
                        variant === undefined ||
                        unitPrice === undefined ||
                        unitPrice === null ||
                        quantity < 1 ||
                        quantity > most
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-[#0D6EFD] px-5 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {processing ? (
                        <LoaderCircle size={17} className="animate-spin" />
                    ) : (
                        <ShoppingCart size={17} />
                    )}
                    Add to Cart
                </button>
            </div>
        </form>
    );
}

function UnitChip({
    chosen,
    disabled,
    onClick,
    label,
    price,
}: {
    chosen: boolean;
    disabled: boolean;
    onClick: () => void;
    label: string;
    price: number | null;
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={cn(
                'rounded-xl border px-3 py-2 text-left text-sm font-bold transition',
                chosen
                    ? 'border-[#0D6EFD] bg-blue-50 text-blue-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                disabled &&
                    'cursor-not-allowed border-dashed bg-slate-50 text-slate-400 hover:border-slate-200',
            )}
        >
            {label}
            {price !== null && (
                <span className="block text-xs font-normal text-slate-500">
                    {formatPeso(price)}
                </span>
            )}
        </button>
    );
}
