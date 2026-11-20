import { formatUnits } from '@/lib/units';
import type { StorefrontProductDetails } from '@/types';

type StorefrontVariant = StorefrontProductDetails['variants'][number];

/**
 * How many of the size or color the buyer clicked are left, shown before
 * they type a number (panel revision, 20 Nov 2026): "12 pcs left" in green,
 * "Only 3 pcs left" in amber when few are left, "Out of stock" in red.
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
