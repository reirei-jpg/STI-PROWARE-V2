import { Link } from '@inertiajs/react';
import { Boxes, Unlink } from 'lucide-react';
import ItemLinkController from '@/actions/App/Http/Controllers/ItemLinkController';
import InputError from '@/components/input-error';
import { formatUnits, unitWord } from '@/lib/units';
import { cn } from '@/lib/utils';
import type { WaitingItemGroup } from '@/types';

/** The look of a number or text box on the Record Delivery page and popup. */
export const deliveryInputClasses =
    'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100';

/**
 * How Head Office sends this item (by the piece or by a pack, and how many
 * pieces are in one) and the product it goes into, or a warning that it is
 * not linked to a product yet, so it will not be added to stock and its
 * numbers are as ordered on the eStore.
 */
export function StockTargetNote({ group }: { group: WaitingItemGroup }) {
    const target = group.stock_target;

    if (target === null) {
        return (
            <div className="flex flex-col gap-2 border-b border-amber-100 bg-amber-50 px-6 py-3 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
                <span className="inline-flex items-center gap-2">
                    <Unlink size={16} className="shrink-0" />
                    Not linked to a product yet, so it will not be added to
                    stock, and PROWARE does not know if Head Office counts it by
                    the piece or by the pack. The numbers below are as ordered
                    on the eStore.
                </span>
                <Link
                    href={ItemLinkController.index({
                        query: { search: group.item_code },
                    })}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2 text-sm font-black text-white transition hover:bg-amber-700"
                >
                    Link it now
                </Link>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-1 border-b border-emerald-100 bg-emerald-50 px-6 py-3 text-sm text-emerald-900 sm:flex-row sm:items-center sm:gap-6">
            <span className="inline-flex items-center gap-2">
                <Boxes size={16} className="shrink-0" />
                Head Office sends this{' '}
                <span className="rounded-lg bg-white px-2 py-0.5 font-black text-emerald-800 shadow-sm">
                    {target.pieces_per_unit > 1
                        ? `by the ${target.unit_name} (${target.pieces_per_unit.toLocaleString('en-PH')} pcs each)`
                        : 'by the piece'}
                </span>
            </span>
            <span>
                Goes into stock:{' '}
                <span className="font-black">
                    {target.product_name}
                    {target.split_into.length > 1
                        ? ' — count how many of each arrived below'
                        : target.has_options && ` (${target.variant_label})`}
                </span>
            </span>
        </div>
    );
}

/**
 * For a code shared by several variants (e.g. every color): a box per
 * variant for the pieces counted. The total fills the orders below.
 */
export function SplitCounts({
    group,
    counts,
    onChange,
    problem,
}: {
    group: WaitingItemGroup;
    counts: Record<number, string>;
    onChange: (variantId: number, value: string) => void;
    problem: string | null;
}) {
    const target = group.stock_target;

    if (target === null) {
        return null;
    }

    return (
        <div className="border-b border-slate-100 px-6 py-4">
            <p className="text-sm font-black text-slate-700">
                How many of each did you receive? (pcs)
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {target.split_into.map((variant) => (
                    <label
                        key={variant.id}
                        className="grid gap-1 rounded-xl border border-slate-200 bg-slate-50/60 p-3"
                    >
                        <span className="truncate text-sm font-black text-slate-800">
                            {variant.label}
                        </span>
                        <span className="flex items-center gap-2">
                            <input
                                value={counts[variant.id] ?? ''}
                                onChange={(event) =>
                                    onChange(variant.id, event.target.value)
                                }
                                inputMode="numeric"
                                placeholder="0"
                                className={cn(
                                    deliveryInputClasses,
                                    'text-right',
                                )}
                                aria-label={`Pieces of ${variant.label} received`}
                            />
                            <span className="text-sm font-bold text-slate-500">
                                pcs
                            </span>
                        </span>
                        <span className="text-[11px] text-slate-500">
                            In stock now:{' '}
                            {formatUnits(variant.stock_on_hand, 'Piece')}
                        </span>
                    </label>
                ))}
            </div>
            <InputError className="mt-2" message={problem ?? undefined} />
        </div>
    );
}

/**
 * A number with its unit beside it, e.g. "10 Packs" or "5 pcs". For an
 * item not linked to a product the unit is not known, so only the number
 * is shown (the note above the table says it is as ordered on the eStore).
 */
export function Quantity({
    value,
    target,
}: {
    value: number;
    target: WaitingItemGroup['stock_target'];
}) {
    return (
        <span className="inline-flex items-baseline justify-end gap-1">
            {value.toLocaleString('en-PH')}
            {target && (
                <span className="text-xs font-bold text-slate-500">
                    {unitWord(value, target.unit_name)}
                </span>
            )}
        </span>
    );
}
