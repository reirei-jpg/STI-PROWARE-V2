import { Text, View } from 'react-native';

import { formatPeso } from '@/lib/format';
import type { StorefrontPrice } from '@/lib/types';

/**
 * The price per piece ("₱350", "From ₱350", or ~~₱350~~ ₱300 on sale), then
 * each pack students can buy ("₱900 / Pack of 50"), like the website.
 */
export default function PriceLines({
    price,
    large = false,
}: {
    price: StorefrontPrice;
    large?: boolean;
}) {
    const mainSize = large ? 'text-2xl' : 'text-base';

    return (
        <View className="gap-0.5">
            {price.piece_centavos !== null &&
                (price.sale_centavos !== null ? (
                    <View className="flex-row flex-wrap items-baseline gap-x-1.5">
                        {price.piece_from && (
                            <Text className="font-sans text-xs text-slate-500">
                                From
                            </Text>
                        )}
                        <Text className="font-sans text-xs text-slate-400 line-through">
                            {formatPeso(price.piece_centavos)}
                        </Text>
                        <Text className={`font-sans-bold text-red-600 ${mainSize}`}>
                            {formatPeso(price.sale_centavos)}
                        </Text>
                        <Text className="font-sans text-xs text-slate-500">/ pc</Text>
                    </View>
                ) : (
                    <View className="flex-row flex-wrap items-baseline gap-x-1">
                        {price.piece_from && (
                            <Text className="font-sans text-xs text-slate-500">
                                From
                            </Text>
                        )}
                        <Text className={`font-sans-bold text-blue-700 ${mainSize}`}>
                            {formatPeso(price.piece_centavos)}
                        </Text>
                        <Text className="font-sans text-xs text-slate-500">/ pc</Text>
                    </View>
                ))}

            {price.packs.map((pack) => (
                <View
                    key={pack.name}
                    className="flex-row flex-wrap items-baseline gap-x-1"
                >
                    {pack.sale_price_centavos !== null && (
                        <Text className="font-sans text-xs text-slate-400 line-through">
                            {formatPeso(pack.price_centavos)}
                        </Text>
                    )}
                    <Text
                        className={`font-sans-bold ${pack.sale_price_centavos !== null ? 'text-red-600' : 'text-blue-700'} ${price.piece_centavos === null ? mainSize : 'text-sm'}`}
                    >
                        {formatPeso(pack.sale_price_centavos ?? pack.price_centavos)}
                    </Text>
                    <Text className="font-sans text-xs text-slate-500">
                        / {pack.name} of {pack.pieces}
                    </Text>
                </View>
            ))}
        </View>
    );
}

/** "Ends today", "Ends tomorrow" or "Ends in 3 days", by calendar day. */
export function saleEndsText(endsAt: string): string {
    const end = new Date(endsAt);
    const today = new Date();
    const days = Math.round(
        (new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime() -
            new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
            86_400_000,
    );

    if (days <= 0) {
        return 'Ends today';
    }

    return days === 1 ? 'Ends tomorrow' : `Ends in ${days} days`;
}
