import { useForm, useHttp } from '@inertiajs/react';
import { Link2, LoaderCircle, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ItemLinkController from '@/actions/App/Http/Controllers/ItemLinkController';
import ConfirmDialog from '@/components/confirm-dialog';
import InputError from '@/components/input-error';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { wholeNumberInput } from '@/lib/number-input';
import { formatPeso } from '@/lib/format';
import { formatConversion } from '@/lib/units';
import { cn } from '@/lib/utils';
import type { ItemToLink, LinkableProduct } from '@/types';

const inputClasses =
    'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100';

type SentBy = 'piece' | 'pack' | 'new_pack';

type LinkForm = {
    item_code: string;
    /** One variant, or several that share the code (e.g. sizes S, M, L). */
    product_variant_ids: number[];
    sent_by: SentBy;
    pack_id: string;
    new_pack_name: string;
    new_pack_pieces: string;
};

/**
 * The pop-up where the Specialist links an eStore item to one of her
 * products: she finds the product by name, ticks the variant the item is
 * (or several that share the code, e.g. sizes S, M and L), and says whether
 * Head Office sends it by the piece or by a pack.
 */
export default function LinkItemDialog({
    item,
    onClose,
}: {
    item: ItemToLink | null;
    onClose: () => void;
}) {
    return (
        <Dialog
            open={item !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-2xl [&>button:last-child]:hidden">
                {item && <LinkItemForm item={item} onClose={onClose} />}
            </DialogContent>
        </Dialog>
    );
}

function LinkItemForm({
    item,
    onClose,
}: {
    item: ItemToLink;
    onClose: () => void;
}) {
    const form = useForm<LinkForm>({
        item_code: item.item_code,
        product_variant_ids: [],
        sent_by: 'piece',
        pack_id: '',
        new_pack_name: 'Pack',
        new_pack_pieces: '',
    });
    const { data, setData, processing, errors } = form;

    const http = useHttp<
        Record<string, never>,
        { products: LinkableProduct[] }
    >({});
    // Starts with the eStore name, so the product it matches is listed first.
    const [search, setSearch] = useState(item.description);
    const [results, setResults] = useState<LinkableProduct[] | null>(null);
    const [product, setProduct] = useState<LinkableProduct | null>(null);
    const latestSearch = useRef(0);

    // Find products as the Specialist types, after a short pause.
    useEffect(() => {
        const searchNumber = ++latestSearch.current;
        const timer = window.setTimeout(
            () =>
                void http
                    .get(
                        ItemLinkController.products({
                            query: { search: search.trim() },
                        }).url,
                        {
                            onSuccess: (response) => {
                                if (searchNumber === latestSearch.current) {
                                    setResults(response.products);
                                }
                            },
                        },
                    )
                    .catch(() => setResults([])),
            search === '' ? 0 : 300,
        );

        return () => window.clearTimeout(timer);
        // Only the typed text should trigger a search; `http` changes on
        // every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const chooseProduct = (chosen: LinkableProduct) => {
        const free = chosen.variants.filter(
            (variant) => variant.estore_item_code === null,
        );

        setProduct(chosen);
        setData({
            ...data,
            product_variant_ids: free.length === 1 ? [free[0].id] : [],
            sent_by: 'piece',
            pack_id: '',
        });
    };

    const toggleVariant = (id: number) =>
        setData(
            'product_variant_ids',
            data.product_variant_ids.includes(id)
                ? data.product_variant_ids.filter((chosen) => chosen !== id)
                : [...data.product_variant_ids, id],
        );

    const freeVariants =
        product?.variants.filter(
            (variant) => variant.estore_item_code === null,
        ) ?? [];
    const allFreeTicked =
        freeVariants.length > 0 &&
        freeVariants.every((variant) =>
            data.product_variant_ids.includes(variant.id),
        );
    const shared = data.product_variant_ids.length > 1;

    const chosenPack = product?.packs.find(
        (pack) => String(pack.id) === data.pack_id,
    );
    const piecesPerUnit =
        data.sent_by === 'pack'
            ? (chosenPack?.pieces ?? null)
            : data.sent_by === 'new_pack'
              ? Number(data.new_pack_pieces) || null
              : 1;
    const unitName =
        data.sent_by === 'pack'
            ? (chosenPack?.name ?? 'Pack')
            : data.sent_by === 'new_pack'
              ? data.new_pack_name.trim() || 'Pack'
              : 'Piece';

    // A link cannot be taken back, and what already arrived goes into stock
    // at once, so the Specialist answers first.
    const [confirming, setConfirming] = useState<{
        question: LinkQuestion;
        run: () => void;
    } | null>(null);

    const submit = () => {
        form.post(ItemLinkController.store().url, {
            preserveScroll: true,
            onSuccess: onClose,
            onFinish: () => setConfirming(null),
        });
    };

    // One button: the product's sizes or colors without a code, by the
    // piece. How many of each arrived is asked when it is in stock.
    const linkTo = (chosen: LinkableProduct) => {
        const free = chosen.variants.filter(
            (variant) => variant.estore_item_code === null,
        );

        form.transform(() => ({
            item_code: item.item_code,
            product_variant_ids: free.map((variant) => variant.id),
            sent_by: 'piece' as SentBy,
            pack_id: '',
            new_pack_name: 'Pack',
            new_pack_pieces: '',
        }));
        form.post(ItemLinkController.store().url, {
            preserveScroll: true,
            onSuccess: onClose,
            onFinish: () => {
                form.transform((current) => current);
                setConfirming(null);
            },
        });
    };

    const askBeforeLinkTo = (chosen: LinkableProduct) => {
        const free = chosen.variants.filter(
            (variant) => variant.estore_item_code === null,
        );

        setConfirming({
            question: {
                productName: chosen.name,
                variantLabels:
                    chosen.variants.length > 1
                        ? free.map((variant) => variant.label)
                        : [],
                unitName: 'Piece',
                piecesPerUnit: 1,
            },
            run: () => linkTo(chosen),
        });
    };

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();

                if (!product) {
                    return;
                }

                setConfirming({
                    question: {
                        productName: product.name,
                        variantLabels:
                            product.variants.length > 1
                                ? product.variants
                                      .filter((variant) =>
                                          data.product_variant_ids.includes(
                                              variant.id,
                                          ),
                                      )
                                      .map((variant) => variant.label)
                                : [],
                        unitName,
                        piecesPerUnit,
                    },
                    run: submit,
                });
            }}
            className="flex min-h-0 flex-col"
        >
            <ConfirmDialog
                open={confirming !== null}
                title={`Link ${item.item_code} to ${confirming?.question.productName ?? ''}?`}
                description={
                    confirming ? linkQuestion(item, confirming.question) : ''
                }
                cancelLabel="Check again"
                confirmLabel="Link Item"
                busy={processing}
                onConfirm={() => confirming?.run()}
                onClose={() => setConfirming(null)}
            />
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <Link2 size={22} />
                    </span>
                    <div>
                        <DialogTitle className="text-lg font-black text-slate-900">
                            Link{' '}
                            <span className="font-mono">{item.item_code}</span>
                        </DialogTitle>
                        <DialogDescription className="text-sm text-slate-500">
                            {item.description}
                        </DialogDescription>
                    </div>
                </div>
                <DialogClose className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                    <X size={20} />
                    <span className="sr-only">Close</span>
                </DialogClose>
            </div>

            <div className="space-y-6 overflow-y-auto px-6 py-5">
                <section className="space-y-2">
                    <p className="text-sm font-black text-slate-700">
                        1. Which product is it?
                    </p>
                    {product ? (
                        <div className="flex items-center justify-between gap-3 rounded-xl border border-[#0D6EFD] bg-blue-50 px-4 py-3">
                            <span className="font-black text-blue-900">
                                {product.name}
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    setProduct(null);
                                    setData('product_variant_ids', []);
                                }}
                                className="rounded-xl border border-blue-200 bg-white px-3 py-1.5 text-sm font-black text-blue-700 transition hover:bg-blue-100"
                            >
                                Change
                            </button>
                        </div>
                    ) : (
                        <>
                            <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-400 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
                                <Search size={18} className="shrink-0" />
                                <input
                                    type="search"
                                    maxLength={120}
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                    placeholder="Type the product name"
                                    className="w-full min-w-0 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400"
                                    aria-label="Find the product"
                                    autoFocus
                                />
                            </label>
                            <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200">
                                {results === null ? (
                                    <p className="flex items-center gap-2 px-4 py-3 text-sm text-slate-500">
                                        <LoaderCircle
                                            size={16}
                                            className="animate-spin"
                                        />
                                        Finding products...
                                    </p>
                                ) : results.length === 0 ? (
                                    <p className="px-4 py-3 text-sm text-slate-500">
                                        No product found. Close this and use
                                        "Create product" instead.
                                    </p>
                                ) : (
                                    results.map((result) => {
                                        const free = result.variants.filter(
                                            (variant) =>
                                                variant.estore_item_code ===
                                                null,
                                        ).length;

                                        return (
                                            <div
                                                key={result.id}
                                                className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0"
                                            >
                                                <div className="min-w-0">
                                                    <p className="font-bold text-slate-800">
                                                        {result.name}
                                                        {result.status_label ===
                                                            'Preorder' && (
                                                            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-black text-amber-800">
                                                                Coming Soon
                                                            </span>
                                                        )}
                                                    </p>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            chooseProduct(
                                                                result,
                                                            )
                                                        }
                                                        className="text-xs font-semibold text-slate-500 hover:text-blue-700"
                                                    >
                                                        {result.variants
                                                            .length === 1
                                                            ? '1 variant'
                                                            : `${result.variants.length} variants`}{' '}
                                                        · choose them yourself
                                                    </button>
                                                </div>
                                                {free > 0 ? (
                                                    <button
                                                        type="button"
                                                        disabled={processing}
                                                        onClick={() =>
                                                            askBeforeLinkTo(
                                                                result,
                                                            )
                                                        }
                                                        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#0D6EFD] px-3 py-2 text-xs font-black text-white transition hover:bg-blue-700 disabled:opacity-60"
                                                    >
                                                        <Link2 size={14} />
                                                        Link to this product
                                                    </button>
                                                ) : (
                                                    <span className="shrink-0 text-xs font-semibold text-slate-400">
                                                        Already linked
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </>
                    )}
                    <InputError message={errors.item_code} />
                </section>

                {product && (
                    <section className="space-y-2">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <p className="text-sm font-black text-slate-700">
                                2. Which variant is it?
                            </p>
                            {freeVariants.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        setData(
                                            'product_variant_ids',
                                            allFreeTicked
                                                ? []
                                                : freeVariants.map(
                                                      (variant) => variant.id,
                                                  ),
                                        )
                                    }
                                    className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-black text-blue-700 transition hover:bg-blue-100"
                                >
                                    {allFreeTicked ? 'Untick all' : 'Tick all'}
                                </button>
                            )}
                        </div>
                        {product.variants.length > 1 && (
                            <p className="text-xs leading-5 text-slate-500">
                                Tick one, or tick several if they all come under
                                this one code (e.g. sizes S, M and L of one
                                jacket). For several, you enter how many of each
                                you received when it arrives.
                            </p>
                        )}
                        <div className="grid gap-2 sm:grid-cols-2">
                            {product.variants.map((variant) => {
                                const taken = variant.estore_item_code !== null;
                                const ticked =
                                    data.product_variant_ids.includes(
                                        variant.id,
                                    );

                                return (
                                    <label
                                        key={variant.id}
                                        className={cn(
                                            'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition',
                                            taken
                                                ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400'
                                                : ticked
                                                  ? 'cursor-pointer border-[#0D6EFD] bg-blue-50 text-blue-800'
                                                  : 'cursor-pointer border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                                        )}
                                    >
                                        <input
                                            type="checkbox"
                                            disabled={taken}
                                            checked={ticked}
                                            onChange={() =>
                                                toggleVariant(variant.id)
                                            }
                                            className="h-4 w-4 shrink-0 accent-[#0D6EFD]"
                                        />
                                        <span>
                                            {variant.label}
                                            {taken && (
                                                <span className="block font-mono text-xs font-normal">
                                                    has{' '}
                                                    {variant.estore_item_code}
                                                </span>
                                            )}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                        {shared && (
                            <p className="rounded-xl bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-900">
                                {data.product_variant_ids.length} variants will
                                share {item.item_code}. When it arrives, Record
                                Delivery shows a box for each of them.
                            </p>
                        )}
                        <InputError message={errors.product_variant_ids} />
                    </section>
                )}

                {product && (
                    <section className="space-y-2">
                        <p className="text-sm font-black text-slate-700">
                            3. How does Head Office send it?
                        </p>
                        <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                            On the eStore, Head Office charges{' '}
                            <span className="font-black text-slate-800">
                                {formatPeso(item.unit_price_centavos)}
                            </span>{' '}
                            for each one you order. If that is the price of one
                            piece, choose <b>By the piece</b>. If it is the
                            price of a whole pack or box, choose that pack.
                        </p>
                        <div className="grid gap-2">
                            <SentByChoice
                                label="By the piece"
                                checked={data.sent_by === 'piece'}
                                onChange={() =>
                                    setData({
                                        ...data,
                                        sent_by: 'piece',
                                        pack_id: '',
                                    })
                                }
                            />
                            {product.packs.map((pack) => (
                                <SentByChoice
                                    key={pack.id}
                                    label={`By the ${pack.name} (${pack.pieces.toLocaleString('en-PH')} pieces)`}
                                    checked={
                                        data.sent_by === 'pack' &&
                                        data.pack_id === String(pack.id)
                                    }
                                    onChange={() =>
                                        setData({
                                            ...data,
                                            sent_by: 'pack',
                                            pack_id: String(pack.id),
                                        })
                                    }
                                />
                            ))}
                            <SentByChoice
                                label="By a new pack"
                                checked={data.sent_by === 'new_pack'}
                                onChange={() =>
                                    setData({
                                        ...data,
                                        sent_by: 'new_pack',
                                        pack_id: '',
                                    })
                                }
                            />
                            {data.sent_by === 'new_pack' && (
                                <div className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
                                    <label className="grid gap-1">
                                        <span className="text-xs font-bold text-slate-500">
                                            Pack name
                                        </span>
                                        <input
                                            value={data.new_pack_name}
                                            onChange={(event) =>
                                                setData(
                                                    'new_pack_name',
                                                    event.target.value,
                                                )
                                            }
                                            list="link-pack-names"
                                            maxLength={30}
                                            className={inputClasses}
                                        />
                                        <InputError
                                            message={errors.new_pack_name}
                                        />
                                    </label>
                                    <label className="grid gap-1">
                                        <span className="text-xs font-bold text-slate-500">
                                            Pieces in one pack
                                        </span>
                                        <input
                                            value={data.new_pack_pieces}
                                            onChange={(event) =>
                                                setData(
                                                    'new_pack_pieces',
                                                    wholeNumberInput(
                                                        event.target.value,
                                                        100000,
                                                    ),
                                                )
                                            }
                                            inputMode="numeric"
                                            placeholder="50"
                                            className={inputClasses}
                                        />
                                        <InputError
                                            message={errors.new_pack_pieces}
                                        />
                                    </label>
                                    <datalist id="link-pack-names">
                                        <option value="Pack" />
                                        <option value="Box" />
                                        <option value="Bundle" />
                                        <option value="Dozen" />
                                        <option value="Set" />
                                    </datalist>
                                </div>
                            )}
                        </div>
                        <InputError
                            message={errors.sent_by ?? errors.pack_id}
                        />
                    </section>
                )}

                {product && item.waiting_for_stock > 0 && shared && (
                    <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        Already received:{' '}
                        {item.waiting_for_stock.toLocaleString('en-PH')} (as
                        ordered on the eStore). After linking, it shows under
                        "Received, split it into stock" on this page, where you
                        enter how many of each variant it was.
                    </p>
                )}

                {product && item.waiting_for_stock > 0 && !shared && (
                    <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        Already received:{' '}
                        {item.waiting_for_stock.toLocaleString('en-PH')} (as
                        ordered on the eStore).{' '}
                        {piecesPerUnit === null ? (
                            'Enter the pieces in one pack to see how many go into stock.'
                        ) : (
                            <>
                                With this choice,{' '}
                                <span className="font-black">
                                    {formatConversion(
                                        item.waiting_for_stock,
                                        unitName,
                                        piecesPerUnit,
                                    )}
                                </span>{' '}
                                go into stock.
                            </>
                        )}
                    </p>
                )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
                {data.product_variant_ids.length === 0 && (
                    <p className="mr-auto text-xs font-semibold text-slate-500">
                        {product
                            ? 'Tick at least one variant to link.'
                            : 'Press Link to this product, or choose its variants yourself.'}
                    </p>
                )}
                <DialogClose className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50">
                    Cancel
                </DialogClose>
                <button
                    type="submit"
                    disabled={
                        processing || data.product_variant_ids.length === 0
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-[#0D6EFD] px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {processing ? (
                        <LoaderCircle size={17} className="animate-spin" />
                    ) : (
                        <Link2 size={17} />
                    )}
                    Link Item
                </button>
            </div>
        </form>
    );
}

type LinkQuestion = {
    productName: string;
    /** The sizes or colors that get the code; empty for one variant. */
    variantLabels: string[];
    unitName: string;
    /** Null while a new pack's pieces are not entered. */
    piecesPerUnit: number | null;
};

/**
 * What linking does: which variants get the code, how it is sent, and what
 * already arrived goes into stock now (or is split next, for a shared code).
 */
function linkQuestion(item: ItemToLink, question: LinkQuestion): string {
    const shared = question.variantLabels.length > 1;
    const which =
        question.variantLabels.length === 0
            ? question.productName
            : `${question.productName} (${question.variantLabels.join(', ')})`;
    const sentBy =
        question.unitName === 'Piece'
            ? 'by the piece'
            : `by the ${question.unitName}${question.piecesPerUnit ? ` of ${question.piecesPerUnit.toLocaleString('en-PH')}` : ''}`;
    let arrived = '';

    if (item.waiting_for_stock > 0 && shared) {
        arrived = ` The ${item.waiting_for_stock.toLocaleString('en-PH')} that already arrived are split into stock on this page next.`;
    } else if (item.waiting_for_stock > 0 && question.piecesPerUnit) {
        arrived = ` ${formatConversion(item.waiting_for_stock, question.unitName, question.piecesPerUnit)} that already arrived go into stock now, and buyers waiting for it are served first and notified.`;
    }

    return `Every delivery of ${item.item_code} goes to ${which}, sent ${sentBy}.${arrived} This cannot be undone.`;
}

function SentByChoice({
    label,
    checked,
    onChange,
}: {
    label: string;
    checked: boolean;
    onChange: () => void;
}) {
    return (
        <label
            className={cn(
                'flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition',
                checked
                    ? 'border-[#0D6EFD] bg-blue-50 text-blue-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
            )}
        >
            <input
                type="radio"
                name="sent_by"
                checked={checked}
                onChange={onChange}
                className="h-4 w-4 shrink-0 accent-[#0D6EFD]"
            />
            {label}
        </label>
    );
}
