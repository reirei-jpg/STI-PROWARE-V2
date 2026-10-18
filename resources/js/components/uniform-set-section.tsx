import { useForm, usePage } from '@inertiajs/react';
import { ImageIcon, LoaderCircle, Minus, Plus, Shirt, X } from 'lucide-react';
import { useState } from 'react';
import CartController from '@/actions/App/Http/Controllers/CartController';
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
import { MAX_PER_ITEM, wholeNumberInput } from '@/lib/number-input';
import { cn } from '@/lib/utils';
import type { StorefrontUniformSet, StorefrontSetPiece, User } from '@/types';

/**
 * The Uniform Sets section of the storefront: each course's whole uniform
 * at one set price. Buy the Set opens the picker (a signed-out visitor is
 * asked to sign in first). Hidden when no set is for sale.
 */
export default function UniformSetSection({
    sets,
}: {
    sets: StorefrontUniformSet[];
}) {
    const { auth } = usePage<{ auth: { user: User | null } }>().props;
    const openSignIn = useSignInPrompt();
    const [buying, setBuying] = useState<StorefrontUniformSet | null>(null);

    if (sets.length === 0) {
        return null;
    }

    return (
        <section
            id="uniform-sets"
            aria-label="Uniform Sets"
            className="scroll-mt-24 rounded-3xl border border-blue-100 bg-linear-to-br from-blue-50 via-sky-50 to-white p-5 md:p-6"
        >
            <div className="mb-4 flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0D6EFD] text-white">
                    <Shirt size={20} />
                </span>
                <div>
                    <h2 className="text-xl font-black text-slate-900 md:text-2xl">
                        Uniform Sets
                    </h2>
                    <p className="text-sm text-slate-500">
                        The whole uniform at one price: top and bottom, in your
                        sizes.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
                {sets.map((set) => (
                    <article
                        key={set.id}
                        className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                    >
                        <div className="flex aspect-square items-center justify-center bg-slate-100 text-slate-300">
                            {set.photo_url ? (
                                <img
                                    src={set.photo_url}
                                    alt=""
                                    loading="lazy"
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <ImageIcon size={36} />
                            )}
                        </div>
                        <div className="flex flex-1 flex-col gap-2 p-3">
                            <h3 className="text-sm leading-5 font-bold text-slate-900">
                                {set.name}
                            </h3>
                            <p className="text-xs leading-5 text-slate-500">
                                {set.options
                                    .map(
                                        (option) =>
                                            `${option.label}: ${option.top.kind} + ${option.bottoms.map((bottom) => bottom.kind).join(' or ')}`,
                                    )
                                    .join(' · ')}
                            </p>
                            <p className="flex items-baseline gap-1">
                                <span className="text-base font-black text-blue-700">
                                    {formatPeso(set.price_centavos)}
                                </span>
                                <span className="text-xs text-slate-500">
                                    / set
                                </span>
                            </p>
                            <button
                                type="button"
                                onClick={() =>
                                    auth.user === null
                                        ? openSignIn()
                                        : setBuying(set)
                                }
                                className="mt-auto inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#0D6EFD] px-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98]"
                            >
                                <Shirt size={16} />
                                Buy the Set
                            </button>
                        </div>
                    </article>
                ))}
            </div>

            <Dialog
                open={buying !== null}
                onOpenChange={(open) => !open && setBuying(null)}
            >
                <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-lg [&>button:last-child]:hidden">
                    {buying && (
                        <>
                            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                                <div className="flex items-start gap-3">
                                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                                        <Shirt size={22} />
                                    </span>
                                    <div>
                                        <DialogTitle className="text-lg font-black text-slate-900">
                                            Buy the Set
                                        </DialogTitle>
                                        <DialogDescription className="text-sm text-slate-500">
                                            {buying.name}
                                        </DialogDescription>
                                    </div>
                                </div>
                                <DialogClose className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                                    <X size={20} />
                                    <span className="sr-only">Close</span>
                                </DialogClose>
                            </div>

                            {auth.user?.role !== 'student' ? (
                                <p className="px-6 py-8 text-center text-sm leading-6 text-slate-600">
                                    Buying is for students. You are signed in
                                    with a staff account.
                                </p>
                            ) : (
                                <SetPicker
                                    key={buying.id}
                                    set={buying}
                                    onDone={() => setBuying(null)}
                                />
                            )}
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </section>
    );
}

/**
 * For boys or girls, the top's size, the bottom (for girls: ladies' pants
 * or skirt) and its size, and how many sets. Sold-out sizes are crossed out:
 * they are preordered on the item itself.
 */
function SetPicker({
    set,
    onDone,
}: {
    set: StorefrontUniformSet;
    onDone: () => void;
}) {
    const form = useForm({
        for: set.options.length === 1 ? set.options[0].for : '',
        top_variant_id: '',
        bottom_variant_id: '',
        quantity: '1',
    });
    const { data, setData, errors, processing } = form;
    const [bottomId, setBottomId] = useState<number | null>(null);

    const option = set.options.find((item) => item.for === data.for);
    const bottom =
        option?.bottoms.length === 1
            ? option.bottoms[0]
            : option?.bottoms.find((item) => item.product_id === bottomId);
    const topSize = option?.top.sizes.find(
        (size) => String(size.variant_id) === data.top_variant_id,
    );
    const bottomSize = bottom?.sizes.find(
        (size) => String(size.variant_id) === data.bottom_variant_id,
    );
    const most = Math.min(
        MAX_PER_ITEM,
        topSize?.stock_pieces ?? MAX_PER_ITEM,
        bottomSize?.stock_pieces ?? MAX_PER_ITEM,
    );
    const quantity = Number(data.quantity) || 0;
    // One by one, the two pieces may cost less (e.g. while one is on sale).
    const separately =
        topSize?.price_centavos != null && bottomSize?.price_centavos != null
            ? topSize.price_centavos + bottomSize.price_centavos
            : null;
    const setPrice =
        separately === null
            ? set.price_centavos
            : Math.min(set.price_centavos, separately);
    const missing = [
        !option && 'who it is for',
        option && !topSize && `the ${option.top.kind.toLowerCase()} size`,
        option && !bottom && 'the bottom',
        bottom && !bottomSize && `the ${bottom.kind.toLowerCase()} size`,
    ].filter(Boolean);

    const setQuantity = (value: number) =>
        setData('quantity', String(Math.max(1, Math.min(value, most || 1))));

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                form.post(CartController.storeSet(set.id).url, {
                    preserveScroll: true,
                    onSuccess: onDone,
                });
            }}
            className="flex min-h-0 flex-col"
        >
            <div className="space-y-5 overflow-y-auto px-6 py-5">
                {set.options.length > 1 && (
                    <ChipRow
                        label="Who is it for?"
                        chips={set.options.map((item) => ({
                            key: item.for,
                            label: item.label,
                            chosen: data.for === item.for,
                            disabled: false,
                            onPick: () => {
                                setData({
                                    for: item.for,
                                    top_variant_id: '',
                                    bottom_variant_id: '',
                                    quantity: '1',
                                });
                                setBottomId(null);
                            },
                        }))}
                        error={errors.for}
                    />
                )}

                {option && (
                    <SizeRow
                        piece={option.top}
                        chosen={data.top_variant_id}
                        onPick={(variantId) => {
                            setData('top_variant_id', variantId);
                            setData('quantity', '1');
                        }}
                        error={errors.top_variant_id}
                    />
                )}

                {option && option.bottoms.length > 1 && (
                    <ChipRow
                        label="Bottom"
                        chips={option.bottoms.map((item) => ({
                            key: String(item.product_id),
                            label: item.kind,
                            chosen: bottom?.product_id === item.product_id,
                            disabled: false,
                            onPick: () => {
                                setBottomId(item.product_id);
                                setData('bottom_variant_id', '');
                            },
                        }))}
                    />
                )}

                {bottom && (
                    <SizeRow
                        piece={bottom}
                        chosen={data.bottom_variant_id}
                        onPick={(variantId) => {
                            setData('bottom_variant_id', variantId);
                            setData('quantity', '1');
                        }}
                        error={errors.bottom_variant_id}
                    />
                )}

                {option && (
                    <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
                        A crossed-out size is out of stock. You can preorder it
                        on the item itself, and you will be notified when it is
                        back in stock.
                    </p>
                )}

                <section className="space-y-2">
                    <p className="text-sm font-black text-slate-700">
                        How many sets?
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
                                    wholeNumberInput(
                                        event.target.value,
                                        Math.max(most, 1),
                                    ),
                                )
                            }
                            onBlur={() => setQuantity(quantity)}
                            inputMode="numeric"
                            className="h-11 w-20 rounded-xl border border-slate-200 text-center text-sm font-black text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            aria-label="How many sets"
                        />
                        <button
                            type="button"
                            onClick={() => setQuantity(quantity + 1)}
                            disabled={quantity >= most}
                            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                            aria-label="One more"
                        >
                            <Plus size={16} />
                        </button>
                        <span className="text-sm text-slate-500">
                            {quantity === 1 ? 'set' : 'sets'}
                        </span>
                    </div>
                    <InputError message={errors.quantity} />
                </section>

                <div className="space-y-1 rounded-xl bg-slate-50 px-4 py-3 text-sm">
                    <p className="flex items-baseline justify-between">
                        <span className="font-bold text-slate-600">
                            Set price
                        </span>
                        <span className="text-lg font-black text-slate-900">
                            {formatPeso(setPrice * Math.max(quantity, 1))}
                        </span>
                    </p>
                    {separately !== null && separately > setPrice && (
                        <p className="text-xs text-emerald-700">
                            You save{' '}
                            {formatPeso(
                                (separately - setPrice) * Math.max(quantity, 1),
                            )}{' '}
                            compared with buying them one by one (
                            {formatPeso(separately)} a set).
                        </p>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
                {missing.length > 0 && (
                    <p className="mr-auto text-xs font-semibold text-slate-500">
                        Choose {missing.join(' and ')} first.
                    </p>
                )}
                <DialogClose className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50">
                    Cancel
                </DialogClose>
                <button
                    type="submit"
                    disabled={processing || missing.length > 0 || quantity < 1}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#0D6EFD] px-5 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {processing ? (
                        <LoaderCircle size={17} className="animate-spin" />
                    ) : (
                        <Shirt size={17} />
                    )}
                    Add Set to Cart
                </button>
            </div>
        </form>
    );
}

function ChipRow({
    label,
    chips,
    error,
}: {
    label: string;
    chips: {
        key: string;
        label: string;
        chosen: boolean;
        disabled: boolean;
        onPick: () => void;
    }[];
    error?: string;
}) {
    return (
        <section className="space-y-2">
            <p className="text-sm font-black text-slate-700">{label}</p>
            <div className="flex flex-wrap gap-2">
                {chips.map((chip) => (
                    <button
                        key={chip.key}
                        type="button"
                        disabled={chip.disabled}
                        onClick={chip.onPick}
                        title={chip.disabled ? 'Out of stock' : undefined}
                        className={cn(
                            'min-w-14 rounded-xl border px-3 py-2 text-sm font-bold transition',
                            chip.chosen
                                ? 'border-[#0D6EFD] bg-blue-50 text-blue-800'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                            chip.disabled &&
                                'cursor-not-allowed border-dashed bg-slate-50 text-slate-400 line-through hover:border-slate-200',
                        )}
                    >
                        {chip.label}
                    </button>
                ))}
            </div>
            <InputError message={error} />
        </section>
    );
}

/** "Polo size": the piece's sizes; sold-out ones are crossed out. */
function SizeRow({
    piece,
    chosen,
    onPick,
    error,
}: {
    piece: StorefrontSetPiece;
    chosen: string;
    onPick: (variantId: string) => void;
    error?: string;
}) {
    return (
        <ChipRow
            label={`${piece.kind} size`}
            chips={piece.sizes.map((size) => ({
                key: String(size.variant_id),
                label: size.label,
                chosen: chosen === String(size.variant_id),
                disabled: size.stock_pieces === 0,
                onPick: () => onPick(String(size.variant_id)),
            }))}
            error={error}
        />
    );
}
