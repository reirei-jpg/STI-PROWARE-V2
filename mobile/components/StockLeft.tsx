import { Text, View } from 'react-native';

import { formatUnits } from '@/lib/format';
import type { StorefrontProductDetails } from '@/lib/types';

type StorefrontVariant = StorefrontProductDetails['variants'][number];

/**
 * How many of one size or color are left, shown before the buyer types a
 * number (panel revision, 20 Nov 2026), as on the website: "12 pcs left" in
 * green, "Only 3 pcs left" in amber when few are left, "Out of stock" in red.
 */
export function stockLeft(variant: StorefrontVariant): { text: string; tone: string } {
    if (variant.availability === 'sold_out') {
        return {
            text: variant.available_soon ? 'Out of stock · Available soon' : 'Out of stock',
            tone: 'text-red-600',
        };
    }

    if (variant.availability === 'almost_sold_out') {
        return { text: `Only ${formatUnits(variant.stock_pieces, 'Piece')} left`, tone: 'text-amber-700' };
    }

    return { text: `${formatUnits(variant.stock_pieces, 'Piece')} left`, tone: 'text-emerald-700' };
}

/** Every size and color with how many are left (not for Coming Soon products). */
export default function StockLeftList({ variants }: { variants: StorefrontVariant[] }) {
    return (
        <View className="gap-1.5">
            <Text className="font-sans-bold text-sm text-slate-700">In stock now</Text>
            <View className="rounded-xl border border-slate-200 bg-white">
                {variants.map((variant, index) => {
                    const left = stockLeft(variant);

                    return (
                        <View
                            key={variant.id}
                            className={`flex-row items-center justify-between gap-3 px-3 py-2 ${index > 0 ? 'border-t border-slate-100' : ''}`}
                        >
                            <Text className="flex-1 font-sans text-sm text-slate-700">
                                {variant.label || 'This item'}
                            </Text>
                            <Text className={`font-sans-bold text-sm ${left.tone}`}>{left.text}</Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}
