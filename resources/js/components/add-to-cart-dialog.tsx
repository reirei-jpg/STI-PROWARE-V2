import { useForm, useHttp, usePage } from '@inertiajs/react';
import {
    CalendarClock,
    LoaderCircle,
    Plus,
    ShoppingCart,
    X,
} from 'lucide-react';
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import CartController from '@/actions/App/Http/Controllers/CartController';
import StorefrontController from '@/actions/App/Http/Controllers/StorefrontController';
import StudentPreorderController from '@/actions/App/Http/Controllers/StudentPreorderController';
import InputError from '@/components/input-error';
import { useSignInPrompt } from '@/components/sign-in-prompt';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import OptionRow from '@/components/option-row';
import QuantityInput from '@/components/quantity-input';
import { formatPeso } from '@/lib/format';
import { MAX_PER_ITEM } from '@/lib/number-input';
import { pickChoice, pickedVariant, startingPicks } from '@/lib/option-picker';
import type { Picked } from '@/lib/option-picker';
import { formatUnits, unitWord } from '@/lib/units';
import { cn } from '@/lib/utils';
import type {
    StorefrontBuyPack,
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
 * and how many, up to what is in stock. A sold-out size can still be
 * picked: it says Out of stock, and the button becomes Preorder (the
 * student is notified when it is back), or it says it will not be
 * restocked.
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

/** A line to add: which size, by the piece or a pack, and how many. */
type CartLine = {
    product_variant_id: string;
    product_pack_id: UnitChoice;
    quantity: string;
};

type PickerVariant = StorefrontProductDetails['variants'][number];

function PickerForm({
    details,
    onClose,
}: {
    details: StorefrontProductDetails;
    onClose: () => void;
}) {
    // Every size can be picked; sold-out ones are crossed out and preordered.
    const anyVariant = () => true;
    const soldOut = (variant: { stock_pieces: number }) =>
        variant.stock_pieces === 0;
    const [picked, setPicked] = useState<Picked>(() =>
        startingPicks(details.variants, anyVariant),
    );
    const soldByPiece = details.variants.some(
        (variant) => variant.buy_price_centavos !== null,
    );
    const firstUnit: UnitChoice = soldByPiece
        ? ''
        : String(details.buy_packs[0]?.id ?? '');
    const [unit, setUnit] = useState<UnitChoice>(firstUnit);
    const [quantityText, setQuantityText] = useState('1');
    // The lines added so far: one Add to Cart button puts them all in.
    const form = useForm<{ items: CartLine[] }>({ items: [] });
    // A sold-out size is preordered instead (by the piece).
    const preorderForm = useForm({ product_variant_id: '', quantity: '' });
    const { data, setData, processing, errors } = form;

    const variantOf = (id: string) =>
        details.variants.find((item) => String(item.id) === id);
    const packOf = (id: UnitChoice) =>
        details.buy_packs.find((item) => String(item.id) === id);
    const priceOf = (
        item: PickerVariant | undefined,
        itemPack: StorefrontBuyPack | undefined,
    ) => (itemPack ? itemPack.price_centavos : item?.buy_price_centavos);
    // "S", "S · Box of 12", "Piece", "Pack of 10" (an item without sizes
    // has no size to name).
    const labelOf = (line: CartLine) => {
        const linePack = packOf(line.product_pack_id);
        const size =
            details.variants.length > 1
                ? (variantOf(line.product_variant_id)?.label ?? '')
                : '';
        const hasPacks = details.buy_packs.length > 0;
        const unitText = linePack
            ? `${linePack.name} of ${linePack.pieces}`
            : hasPacks
              ? 'Piece'
              : '';

        return (
            [size, unitText].filter((part) => part !== '').join(' · ') ||
            'Piece'
        );
    };
    const piecesOf = (line: CartLine) =>
        (Number(line.quantity) || 0) *
        (packOf(line.product_pack_id)?.pieces ?? 1);
    // The most of this size and unit that still fits in its stock, after
    // the other lines of the same size.
    const mostFor = (
        item: PickerVariant | undefined,
        itemPack: StorefrontBuyPack | undefined,
        except?: CartLine,
    ) => {
        if (item === undefined) {
            return 0;
        }

        const listed = data.items
            .filter(
                (line) =>
                    line !== except &&
                    line.product_variant_id === String(item.id),
            )
            .reduce((sum, line) => sum + piecesOf(line), 0);

        return Math.min(
            MAX_PER_ITEM,
            Math.floor(
                Math.max(0, item.stock_pieces - listed) /
                    (itemPack?.pieces ?? 1),
            ),
        );
    };

    const variant = pickedVariant(details.variants, details.options, picked);
    const pack = packOf(unit);
    const piecesPerUnit = pack?.pieces ?? 1;
    const unitName = pack?.name ?? 'Piece';
    const unitPrice = priceOf(variant, pack);
    // This size or color by the piece is on sale (sizes may differ).
    const pieceOnSale =
        pack === undefined && (variant?.sale_price_centavos ?? null) !== null;
    // The chosen size is sold out: preorder it (by the piece) instead.
    const preordering = variant !== undefined && soldOut(variant);
    const existing = data.items.find(
        (line) =>
            variant !== undefined &&
            line.product_variant_id === String(variant.id) &&
            line.product_pack_id === unit,
    );
    const most = preordering
        ? MAX_PER_ITEM
        : Math.min(
              mostFor(variant, pack),
              MAX_PER_ITEM - (Number(existing?.quantity) || 0),
          );
    const quantity = Number(quantityText) || 0;
    const hasChoices = details.variants.length > 1;
    const unitChoices = (soldByPiece ? 1 : 0) + details.buy_packs.length;
    // A list only helps when there is more than one size or unit to pick.
    const canList = hasChoices || unitChoices > 1;
    const canAddChosen =
        variant !== undefined &&
        !preordering &&
        unitPrice !== undefined &&
        unitPrice !== null &&
        quantity >= 1 &&
        quantity <= most;
    // With nothing added yet, Add to Cart sends the size chosen now.
    const lines: CartLine[] =
        data.items.length > 0
            ? data.items
            : canAddChosen
              ? [
                    {
                        product_variant_id: String(variant.id),
                        product_pack_id: unit,
                        quantity: String(quantity),
                    },
                ]
              : [];
    const total = lines.reduce(
        (sum, line) =>
            sum +
            (priceOf(
                variantOf(line.product_variant_id),
                packOf(line.product_pack_id),
            ) ?? 0) *
                (Number(line.quantity) || 0),
        0,
    );
    const chosenNotAdded =
        data.items.length > 0 && canAddChosen && existing === undefined;
    const errorFor = (index: number) =>
        errors[`items.${index}.quantity` as keyof typeof errors] ??
        errors[`items.${index}.product_pack_id` as keyof typeof errors] ??
        errors[`items.${index}.product_variant_id` as keyof typeof errors];
    const listErrors = lines
        .map((_, index) => errorFor(index))
        .filter((message) => message !== undefined);

    const resetPick = () => {
        setPicked(startingPicks(details.variants, anyVariant));
        setUnit(firstUnit);
        setQuantityText('1');
    };

    const addChosen = () => {
        if (!canAddChosen) {
            return;
        }

        setData(
            'items',
            existing
                ? data.items.map((line) =>
                      line === existing
                          ? {
                                ...line,
                                quantity: String(
                                    (Number(line.quantity) || 0) + quantity,
                                ),
                            }
                          : line,
                  )
                : [
                      ...data.items,
                      {
                          product_variant_id: String(variant.id),
                          product_pack_id: unit,
                          quantity: String(quantity),
                      },
                  ],
        );
        form.clearErrors();
        resetPick();
    };

    const preorderChosen = () => {
        if (variant === undefined) {
            return;
        }

        preorderForm.transform(() => ({
            product_variant_id: String(variant.id),
            quantity: String(quantity),
        }));
        preorderForm.post(StudentPreorderController.store(details.id).url, {
            preserveScroll: true,
            // Keep the window open when there are lines still to add.
            onSuccess: () => (data.items.length > 0 ? resetPick() : onClose()),
        });
    };

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                form.transform(() => ({ items: lines }));
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
                                pieceOnSale ||
                                    (pack !== undefined &&
                                        details.status === 'on_sale')
                                    ? 'text-red-600'
                                    : 'text-blue-700',
                            )}
                        >
                            {pieceOnSale && variant?.price_centavos && (
                                <span className="mr-2 text-sm font-normal text-slate-400 line-through">
                                    {formatPeso(variant.price_centavos)}
                                </span>
                            )}
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
                            <p
                                className={cn(
                                    'text-xs font-bold',
                                    preordering
                                        ? 'text-red-600'
                                        : 'text-slate-500',
                                )}
                            >
                                {preordering
                                    ? 'Out of stock'
                                    : variant.pieces_left !== null
                                      ? `Only ${formatUnits(variant.pieces_left, 'Piece')} left`
                                      : 'In stock'}
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
                            canPick={anyVariant}
                            isOut={soldOut}
                            onPick={(choice) => {
                                setPicked(
                                    pickChoice(
                                        details.variants,
                                        details.options,
                                        picked,
                                        option.name,
                                        choice,
                                        anyVariant,
                                    ),
                                );
                                setQuantityText('1');
                                preorderForm.clearErrors();
                            }}
                        />
                    ))}

                {preordering && variant.not_restocked && (
                    <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm leading-6 font-bold text-slate-600">
                        This {hasChoices ? 'size or color' : 'item'} is out of
                        stock and will not be restocked.
                    </p>
                )}

                {preordering && variant.can_preorder && (
                    <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
                        This {hasChoices ? 'size or color' : 'item'} is out of
                        stock. Preorder it: when it is back in stock, your
                        pieces are held for you for 24 hours and you are
                        notified. There is nothing to pay now.
                    </p>
                )}

                {!preordering && unitChoices > 1 && (
                    <section className="space-y-2">
                        <p className="text-sm font-black text-slate-700">
                            Buy by
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {soldByPiece && (
                                <UnitChip
                                    chosen={unit === ''}
                                    disabled={
                                        variant !== undefined &&
                                        variant.buy_price_centavos === null
                                    }
                                    onClick={() => {
                                        setUnit('');
                                        setQuantityText('1');
                                    }}
                                    label="Piece"
                                    price={variant?.buy_price_centavos ?? null}
                                />
                            )}
                            {details.buy_packs.map((item) => (
                                <UnitChip
                                    key={item.id}
                                    chosen={unit === String(item.id)}
                                    disabled={
                                        variant !== undefined &&
                                        variant.stock_pieces < item.pieces
                                    }
                                    onClick={() => {
                                        setUnit(String(item.id));
                                        setQuantityText('1');
                                    }}
                                    label={`${item.name} of ${item.pieces}`}
                                    price={item.price_centavos}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {!(preordering && !variant.can_preorder) && (
                    <section className="space-y-2">
                        <p className="text-sm font-black text-slate-700">
                            {preordering
                                ? 'How many to preorder?'
                                : 'How many?'}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                            <QuantityInput
                                value={quantityText}
                                onChange={setQuantityText}
                                label="How many"
                                most={variant ? most : MAX_PER_ITEM}
                                tone={preordering ? 'amber' : 'blue'}
                            />
                            <span className="text-sm text-slate-500">
                                {preordering
                                    ? unitWord(quantity, 'Piece')
                                    : unitWord(quantity, unitName)}
                                {!preordering &&
                                    piecesPerUnit > 1 &&
                                    ` (${formatUnits(quantity * piecesPerUnit, 'Piece')})`}
                            </span>
                            {canList && !preordering && (
                                <button
                                    type="button"
                                    onClick={addChosen}
                                    disabled={!canAddChosen}
                                    className="ml-auto inline-flex h-11 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-black text-blue-800 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <Plus size={16} />
                                    Add to list
                                </button>
                            )}
                        </div>
                        {!preordering &&
                            variant &&
                            most > 0 &&
                            quantity >= most && (
                                <p className="text-sm font-bold text-amber-700">
                                    Only {formatUnits(most, unitName)} left to
                                    add.
                                </p>
                            )}
                        {!preordering && variant && most === 0 && (
                            <p className="text-sm font-bold text-amber-700">
                                {existing || data.items.length > 0
                                    ? 'Your list already has all that is left of this size.'
                                    : `Not enough left for 1 ${unitName}.`}
                            </p>
                        )}
                        <InputError
                            message={
                                preorderForm.errors.product_variant_id ??
                                preorderForm.errors.quantity
                            }
                        />
                        {canList && data.items.length === 0 && !preordering && (
                            <p className="text-xs text-slate-500">
                                To buy more than one size, color or pack, choose
                                one, press Add to list, then choose the next.
                            </p>
                        )}
                    </section>
                )}

                {data.items.length > 0 && (
                    <section className="space-y-2">
                        <p className="text-sm font-black text-slate-700">
                            Your list
                        </p>
                        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                            {data.items.map((line, index) => {
                                const lineVariant = variantOf(
                                    line.product_variant_id,
                                );
                                const linePack = packOf(line.product_pack_id);
                                const linePrice = priceOf(
                                    lineVariant,
                                    linePack,
                                );
                                const onSale =
                                    linePack === undefined &&
                                    (lineVariant?.sale_price_centavos ??
                                        null) !== null;

                                return (
                                    <li
                                        key={`${line.product_variant_id}-${line.product_pack_id}`}
                                        className="space-y-1 px-3 py-2"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-bold text-slate-800">
                                                    {labelOf(line)}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {onSale &&
                                                        lineVariant?.price_centavos && (
                                                            <span className="mr-1 line-through">
                                                                {formatPeso(
                                                                    lineVariant.price_centavos,
                                                                )}
                                                            </span>
                                                        )}
                                                    <span
                                                        className={cn(
                                                            onSale &&
                                                                'font-bold text-red-600',
                                                        )}
                                                    >
                                                        {formatPeso(
                                                            linePrice ?? 0,
                                                        )}
                                                    </span>{' '}
                                                    each
                                                </p>
                                            </div>
                                            <QuantityInput
                                                value={line.quantity}
                                                onChange={(value) =>
                                                    setData(
                                                        'items',
                                                        data.items.map(
                                                            (other) =>
                                                                other === line
                                                                    ? {
                                                                          ...other,
                                                                          quantity:
                                                                              value,
                                                                      }
                                                                    : other,
                                                        ),
                                                    )
                                                }
                                                label={`How many ${labelOf(line)}`}
                                                most={mostFor(
                                                    lineVariant,
                                                    linePack,
                                                    line,
                                                )}
                                                small
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
                                );
                            })}
                        </ul>
                    </section>
                )}

                {data.items.length === 0 &&
                    listErrors.map((message) => (
                        <InputError key={message} message={message} />
                    ))}
                <InputError message={errors.items} />

                {lines.length > 0 && (
                    <p className="flex items-baseline justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm">
                        <span className="font-bold text-slate-600">
                            {data.items.length > 1 ? 'Total' : 'Subtotal'}
                        </span>
                        <span className="text-lg font-black text-slate-900">
                            {formatPeso(total)}
                        </span>
                    </p>
                )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
                {hasChoices && variant === undefined && lines.length === 0 && (
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
                    <p className="mr-auto text-xs font-semibold text-blue-800">
                        {labelOf({
                            product_variant_id: String(variant.id),
                            product_pack_id: unit,
                            quantity: quantityText,
                        })}{' '}
                        is not in your list yet. Press Add to list to include
                        it.
                    </p>
                )}
                <DialogClose className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50">
                    {preordering && !variant.can_preorder && lines.length === 0
                        ? 'Close'
                        : 'Cancel'}
                </DialogClose>
                {preordering && variant.can_preorder && (
                    <button
                        type="button"
                        onClick={preorderChosen}
                        disabled={preorderForm.processing || quantity < 1}
                        className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-black text-amber-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {preorderForm.processing ? (
                            <LoaderCircle size={17} className="animate-spin" />
                        ) : (
                            <CalendarClock size={17} />
                        )}
                        {data.items.length > 0 && hasChoices
                            ? `Preorder ${variant.label}`
                            : 'Preorder'}
                    </button>
                )}
                {(!preordering || data.items.length > 0) && (
                    <button
                        type="submit"
                        disabled={
                            processing ||
                            lines.length === 0 ||
                            lines.some(
                                (line) => (Number(line.quantity) || 0) < 1,
                            )
                        }
                        className="inline-flex items-center gap-2 rounded-xl bg-[#0D6EFD] px-5 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {processing ? (
                            <LoaderCircle size={17} className="animate-spin" />
                        ) : (
                            <ShoppingCart size={17} />
                        )}
                        {data.items.length > 1
                            ? 'Add all to Cart'
                            : 'Add to Cart'}
                    </button>
                )}
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
