import { router, useForm, useHttp } from '@inertiajs/react';
import { Flame, LoaderCircle, TriangleAlert, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import ProductSaleController from '@/actions/App/Http/Controllers/ProductSaleController';
import InputError from '@/components/input-error';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { formatDateTime, formatPeso } from '@/lib/format';
import { formatUnits } from '@/lib/units';
import { cn } from '@/lib/utils';
import type { ProductSaleDetails } from '@/types';

const inputClasses =
    'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100';

type SaleForm = {
    sale_price: string;
    /** Sale price by normal price, when the variants' prices differ. */
    group_sale_prices: Record<string, string>;
    pack_sale_prices: Record<string, string>;
    days: string;
};

/** "280" or "279.50" → 27950; anything else → null. */
function toCentavos(pesos: string): number | null {
    const trimmed = pesos.trim();

    return /^\d+(\.\d{1,2})?$/.test(trimmed)
        ? Math.round(Number(trimmed) * 100)
        : null;
}

/** Pesos as typed in the form: 28000 → "280", 27950 → "279.50". */
function toPesos(centavos: number | null): string {
    if (centavos === null) {
        return '';
    }

    return centavos % 100 === 0
        ? String(centavos / 100)
        : (centavos / 100).toFixed(2);
}

/**
 * The pop-up where the Specialist puts a product On Sale, or changes or
 * ends its sale: a sale price per piece (one for all variants with the same
 * price, e.g. every color; one per price when sizes are priced differently),
 * optional sale prices for packs, and how many days it lasts. It warns,
 * without blocking, when a sale price is below what Head Office charges
 * the school.
 */
export default function PutOnSaleDialog({
    productId,
    onClose,
}: {
    productId: number | null;
    onClose: () => void;
}) {
    const http = useHttp<Record<string, never>, ProductSaleDetails>({});
    const [details, setDetails] = useState<ProductSaleDetails | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (productId === null) {
            return;
        }

        setDetails(null);
        setFailed(false);

        void http
            .get(ProductSaleController.show(productId).url, {
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
    }, [productId]);

    return (
        <Dialog
            open={productId !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-xl [&>button:last-child]:hidden">
                {failed ? (
                    <div className="px-6 py-14 text-center">
                        <DialogTitle className="text-lg font-black text-slate-800">
                            The product could not be loaded
                        </DialogTitle>
                        <DialogDescription className="mt-2 text-sm text-slate-500">
                            Close this window and try again.
                        </DialogDescription>
                    </div>
                ) : details === null ? (
                    <div className="flex items-center justify-center gap-3 px-6 py-14 text-sm font-semibold text-slate-500">
                        <LoaderCircle
                            size={20}
                            className="animate-spin text-blue-600"
                        />
                        <DialogTitle className="text-sm font-semibold">
                            Loading...
                        </DialogTitle>
                        <DialogDescription className="sr-only">
                            Loading the product
                        </DialogDescription>
                    </div>
                ) : (
                    <SaleFormBody
                        key={details.id}
                        details={details}
                        onClose={onClose}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

function SaleFormBody({
    details,
    onClose,
}: {
    details: ProductSaleDetails;
    onClose: () => void;
}) {
    const runningDays = details.sale?.ends_at
        ? Math.max(
              1,
              Math.round(
                  (new Date(details.sale.ends_at).setHours(0, 0, 0, 0) -
                      new Date().setHours(0, 0, 0, 0)) /
                      86_400_000,
              ),
          )
        : 7;

    // Variants with different normal prices get a sale price per price.
    const byPrice = details.sold_by_piece && details.price_groups.length > 1;

    const form = useForm<SaleForm>({
        sale_price: toPesos(
            details.sale?.sale_price_centavos ??
                details.price_groups[0]?.sale_price_centavos ??
                null,
        ),
        group_sale_prices: Object.fromEntries(
            details.price_groups.map((group) => [
                String(group.price_centavos),
                toPesos(group.sale_price_centavos),
            ]),
        ),
        pack_sale_prices: Object.fromEntries(
            details.packs.map((pack) => [
                String(pack.id),
                toPesos(pack.sale_price_centavos),
            ]),
        ),
        days: String(runningDays),
    });
    const { data, setData, processing } = form;
    const errors = form.errors as Record<string, string | undefined>;
    const [confirmingEnd, setConfirmingEnd] = useState(false);
    const [ending, setEnding] = useState(false);

    const days = Number(data.days);
    const endsAt =
        Number.isInteger(days) && days >= 1 && days <= details.max_days
            ? (() => {
                  const end = new Date();
                  end.setDate(end.getDate() + days);
                  end.setHours(23, 59, 0, 0);

                  return end;
              })()
            : null;

    const cost = details.cost_per_piece_centavos;
    const pieceSale = toCentavos(data.sale_price);

    const endSale = () => {
        setEnding(true);
        router.delete(ProductSaleController.destroy(details.id).url, {
            preserveScroll: true,
            onSuccess: onClose,
            onFinish: () => setEnding(false),
        });
    };

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                form.transform((current) => ({
                    sale_price:
                        details.sold_by_piece && !byPrice
                            ? current.sale_price
                            : '',
                    group_sale_prices: byPrice ? current.group_sale_prices : {},
                    pack_sale_prices: current.pack_sale_prices,
                    days: current.days,
                }));
                form.post(ProductSaleController.store(details.id).url, {
                    preserveScroll: true,
                    onSuccess: onClose,
                });
            }}
            className="flex min-h-0 flex-col"
        >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                        <Flame size={22} />
                    </span>
                    <div>
                        <DialogTitle className="text-lg font-black text-slate-900">
                            {details.sale ? 'Change Sale' : 'Put on Sale'}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-slate-500">
                            {details.name} ·{' '}
                            {details.stock_on_hand.toLocaleString('en-PH')} pcs
                            in stock
                            {details.sale?.ends_at &&
                                ` · on sale until ${formatDateTime(details.sale.ends_at)}`}
                        </DialogDescription>
                    </div>
                </div>
                <DialogClose className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                    <X size={20} />
                    <span className="sr-only">Close</span>
                </DialogClose>
            </div>

            <div className="space-y-5 overflow-y-auto px-6 py-5">
                {details.sold_by_piece &&
                    !byPrice &&
                    details.piece_price_centavos !== null && (
                        <div className="space-y-2">
                            <SalePriceField
                                label="Sale price per piece"
                                hint={`Normal price: ${formatPeso(details.piece_price_centavos)} / pc. Every ${details.price_groups[0]?.variants.length === 1 ? 'piece' : 'variant below'} has this price, so the sale price applies to all.`}
                                value={data.sale_price}
                                onChange={(value) =>
                                    setData('sale_price', value)
                                }
                                error={errors.sale_price}
                                normal={details.piece_price_centavos}
                                sale={pieceSale}
                                cost={cost}
                                unit="piece"
                            />
                            {(details.price_groups[0]?.variants.length ?? 0) >
                                1 && (
                                <VariantList
                                    variants={details.price_groups[0].variants}
                                />
                            )}
                        </div>
                    )}

                {byPrice && (
                    <section className="space-y-3">
                        <div>
                            <p className="text-sm font-black text-slate-700">
                                Sale price per piece
                            </p>
                            <p className="text-xs leading-5 text-slate-500">
                                These variants have different prices, so each
                                price gets its own sale price. Leave one empty
                                to keep those variants at their normal price.
                            </p>
                        </div>
                        {details.price_groups.map((group) => {
                            const key = String(group.price_centavos);

                            return (
                                <div
                                    key={key}
                                    className="space-y-2 rounded-2xl border border-slate-200 p-4"
                                >
                                    <SalePriceField
                                        label={`Normally ${formatPeso(group.price_centavos)} / pc`}
                                        hint={`For ${group.variants.map((variant) => variant.label).join(', ')}.`}
                                        value={
                                            data.group_sale_prices[key] ?? ''
                                        }
                                        onChange={(value) =>
                                            setData('group_sale_prices', {
                                                ...data.group_sale_prices,
                                                [key]: value,
                                            })
                                        }
                                        error={
                                            errors[`group_sale_prices.${key}`]
                                        }
                                        normal={group.price_centavos}
                                        sale={toCentavos(
                                            data.group_sale_prices[key] ?? '',
                                        )}
                                        cost={cost}
                                        unit="piece"
                                    />
                                    <VariantList variants={group.variants} />
                                </div>
                            );
                        })}
                        <InputError message={errors.sale_price} />
                    </section>
                )}

                {details.packs.map((pack) => (
                    <SalePriceField
                        key={pack.id}
                        label={`Sale price per ${pack.name} of ${pack.pieces} (optional)`}
                        hint={`Normal price: ${formatPeso(pack.price_centavos)}. Leave it empty to keep it.`}
                        value={data.pack_sale_prices[String(pack.id)] ?? ''}
                        onChange={(value) =>
                            setData('pack_sale_prices', {
                                ...data.pack_sale_prices,
                                [String(pack.id)]: value,
                            })
                        }
                        error={errors[`pack_sale_prices.${pack.id}`]}
                        normal={pack.price_centavos}
                        sale={toCentavos(
                            data.pack_sale_prices[String(pack.id)] ?? '',
                        )}
                        cost={cost === null ? null : cost * pack.pieces}
                        unit={pack.name}
                    />
                ))}

                <label className="grid gap-1.5">
                    <span className="text-sm font-black text-slate-700">
                        How many days?
                    </span>
                    <span className="flex items-center gap-2">
                        <input
                            value={data.days}
                            onChange={(event) =>
                                setData(
                                    'days',
                                    event.target.value
                                        .replace(/\D/g, '')
                                        .slice(0, 3),
                                )
                            }
                            inputMode="numeric"
                            className={cn(inputClasses, 'w-28 text-right')}
                        />
                        <span className="text-sm font-bold text-slate-500">
                            days (1–{details.max_days})
                        </span>
                    </span>
                    {endsAt && (
                        <span className="text-xs font-bold text-slate-600">
                            Ends{' '}
                            {new Intl.DateTimeFormat('en-PH', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                            }).format(endsAt)}
                            , then it goes back to its normal price by itself.
                        </span>
                    )}
                    <InputError message={errors.days} />
                </label>

                {details.sale && (
                    <div className="rounded-xl border border-slate-200 p-3">
                        {confirmingEnd ? (
                            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                <span className="font-bold text-slate-700">
                                    End the sale now and go back to the normal
                                    price?
                                </span>
                                <span className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setConfirmingEnd(false)}
                                        className="rounded-lg border border-slate-200 px-3 py-1.5 font-black text-slate-700 hover:bg-slate-50"
                                    >
                                        Keep it
                                    </button>
                                    <button
                                        type="button"
                                        onClick={endSale}
                                        disabled={ending}
                                        className="rounded-lg bg-red-600 px-3 py-1.5 font-black text-white hover:bg-red-700 disabled:opacity-60"
                                    >
                                        End sale now
                                    </button>
                                </span>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setConfirmingEnd(true)}
                                className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 text-sm font-black text-red-700 transition hover:bg-red-100"
                            >
                                End sale now
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
                <DialogClose className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50">
                    Cancel
                </DialogClose>
                <button
                    type="submit"
                    disabled={processing}
                    className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-500/20 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {processing ? (
                        <LoaderCircle size={17} className="animate-spin" />
                    ) : (
                        <Flame size={17} />
                    )}
                    {details.sale ? 'Save Changes' : 'Put on Sale'}
                </button>
            </div>
        </form>
    );
}

/**
 * The variants a sale price applies to, with their stock.
 */
function VariantList({
    variants,
}: {
    variants: ProductSaleDetails['price_groups'][number]['variants'];
}) {
    return (
        <ul className="flex flex-wrap gap-1.5">
            {variants.map((variant) => (
                <li
                    key={variant.id}
                    className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700"
                >
                    {variant.label}{' '}
                    <span className="font-normal text-slate-500">
                        · {formatUnits(variant.stock_on_hand, 'Piece')}
                    </span>
                </li>
            ))}
        </ul>
    );
}

/**
 * One sale price with the normal price, the result students see, and a
 * warning (not a block) when it is below what Head Office charges.
 */
function SalePriceField({
    label,
    hint,
    value,
    onChange,
    error,
    normal,
    sale,
    cost,
    unit,
}: {
    label: string;
    hint: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    normal: number;
    sale: number | null;
    cost: number | null;
    unit: string;
}) {
    const belowCost = sale !== null && cost !== null && sale < cost;

    return (
        <label className="grid gap-1.5">
            <span className="text-sm font-black text-slate-700">{label}</span>
            <span className="relative block max-w-48">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm font-bold text-slate-400">
                    ₱
                </span>
                <input
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    inputMode="decimal"
                    className={cn(inputClasses, 'pl-7')}
                />
            </span>
            <span className="text-xs text-slate-500">{hint}</span>
            {cost !== null && (
                <span className="text-xs font-bold text-slate-700">
                    Cost: {formatPeso(cost)} per {unit} (what PROWARE paid on
                    the eStore order)
                </span>
            )}
            {sale !== null && sale < normal && (
                <span className="text-xs font-bold text-slate-700">
                    Students see{' '}
                    <span className="text-slate-400 line-through">
                        {formatPeso(normal)}
                    </span>{' '}
                    <span className="text-red-600">{formatPeso(sale)}</span>
                </span>
            )}
            {belowCost && cost !== null && (
                <span className="flex items-start gap-2 rounded-xl border-l-4 border-red-500 bg-red-50 px-3 py-2 text-xs leading-5 text-red-900">
                    <TriangleAlert size={15} className="mt-0.5 shrink-0" />
                    <span>
                        This price is below the Cost of {formatPeso(cost)}. You
                        lose <b>{formatPeso(cost - sale)}</b> on each {unit} at
                        this price. You can still save it; the Sales Reports
                        will show it as sold below cost.
                    </span>
                </span>
            )}
            <InputError message={error} />
        </label>
    );
}
