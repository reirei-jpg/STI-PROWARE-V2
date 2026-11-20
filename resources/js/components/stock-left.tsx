import { cn } from '@/lib/utils';
import { formatUnits } from '@/lib/units';
import type { StorefrontProductDetails } from '@/types';

type StorefrontVariant = StorefrontProductDetails['variants'][number];

/**
 * How many of one size or color are left, shown before the buyer types a
 * number (panel revision, 20 Nov 2026): "12 pcs left" in green, "Only 3
 * pcs left" in amber when few are left, "Out of stock" in red.
 */
export function stockLeft(variant: StorefrontVariant): {
    text: string;
    tone: string;
} {
    if (variant.availability === 'sold_out') {
        return {
            text: variant.available_soon
                ? 'Out of stock · Available soon'
                : 'Out of stock',
            tone: 'text-red-600',
        };
    }

    if (variant.availability === 'almost_sold_out') {
        return {
            text: `Only ${formatUnits(variant.stock_pieces, 'Piece')} left`,
            tone: 'text-amber-700',
        };
    }

    return {
        text: `${formatUnits(variant.stock_pieces, 'Piece')} left`,
        tone: 'text-emerald-700',
    };
}

/**
 * Every size and color with how many are left, in the product's view
 * (not for Coming Soon products: they are not in stock yet).
 */
export function StockLeftList({ variants }: { variants: StorefrontVariant[] }) {
    return (
        <section className="space-y-1.5">
            <p className="text-sm font-black text-slate-700">In stock now</p>
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
                {variants.map((variant) => {
                    const left = stockLeft(variant);

                    return (
                        <li
                            key={variant.id}
                            className="flex items-center justify-between gap-3 px-3 py-2"
                        >
                            <span className="text-slate-700">
                                {variant.label || 'This item'}
                            </span>
                            <span
                                className={cn(
                                    'shrink-0 font-bold whitespace-nowrap',
                                    left.tone,
                                )}
                            >
                                {left.text}
                            </span>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
