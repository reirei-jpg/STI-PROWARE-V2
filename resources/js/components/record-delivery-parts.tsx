import { unitWord } from '@/lib/units';
import type { WaitingItemGroup } from '@/types';

/** The look of a number or text box in the Record Delivery popup. */
export const deliveryInputClasses =
    'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 aria-invalid:border-red-400 aria-invalid:ring-2 aria-invalid:ring-red-100';

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
