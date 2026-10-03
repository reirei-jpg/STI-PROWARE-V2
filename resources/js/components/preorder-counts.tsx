import { CalendarClock } from 'lucide-react';
import { formatDateOrdered } from '@/lib/format';
import { formatUnits } from '@/lib/units';
import type { PreorderProductSummary } from '@/types';

/**
 * The close date, whether preorders are open, and the Change button for a
 * product still on Preorder.
 */
export function CloseDate({
    product,
    onChange,
}: {
    product: PreorderProductSummary;
    onChange: () => void;
}) {
    return (
        <div className="space-y-1">
            <p className="font-black text-slate-900">
                {product.preorders_close_on
                    ? formatDateOrdered(product.preorders_close_on)
                    : 'No date'}
            </p>
            <span
                className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-black ${
                    product.accepts_preorders
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-600'
                }`}
            >
                {product.accepts_preorders ? 'Open' : 'Closed'}
            </span>
            {product.status === 'preorder' && (
                <button
                    type="button"
                    onClick={onChange}
                    className="mt-1 inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-black text-blue-700 transition hover:bg-blue-100"
                >
                    <CalendarClock size={15} />
                    {product.accepts_preorders
                        ? 'Change date'
                        : 'Reopen / change date'}
                </button>
            )}
        </div>
    );
}

/**
 * Students and pieces for each size or color.
 */
export function VariantCounts({
    product,
}: {
    product: PreorderProductSummary;
}) {
    if (product.variants.length === 1 && product.variants[0].label === null) {
        return <span className="text-slate-400">One size</span>;
    }

    return (
        <ul className="space-y-0.5">
            {product.variants.map((variant) => (
                <li key={variant.id} className="text-slate-700">
                    <span className="font-bold">{variant.label}:</span>{' '}
                    {variant.students === 0
                        ? '—'
                        : `${variant.students} ${variant.students === 1 ? 'student' : 'students'} · ${formatUnits(variant.pieces, 'Piece')}`}
                </li>
            ))}
        </ul>
    );
}
