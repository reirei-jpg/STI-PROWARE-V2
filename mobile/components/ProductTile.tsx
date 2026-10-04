import { CalendarClock, ImageIcon, ShoppingCart } from 'lucide-react-native';
import { Image, Pressable, Text, View } from 'react-native';

import PriceLines, { saleEndsText } from '@/components/PriceLines';
import { formatDate } from '@/lib/format';
import type { StorefrontTileProduct } from '@/lib/types';

/**
 * A merchandise tile, like the website's: square photo, name, price and the
 * button. Badges: SALE (and when it ends), COMING SOON, "Only 3 left", and
 * OUT OF STOCK (greyed, no button). Tapping anywhere opens the product.
 *
 * `compact` is for 3 tiles in a row (On Sale): smaller text, when the sale
 * ends under the price, and no button, since tapping opens the product.
 */
export default function ProductTile({
    product,
    width,
    onOpen,
    compact = false,
}: {
    product: StorefrontTileProduct;
    width: number;
    onOpen: (product: StorefrontTileProduct) => void;
    compact?: boolean;
}) {
    const comingSoon = product.status === 'preorder';
    const onSale = product.status === 'on_sale';

    return (
        <Pressable
            onPress={() => onOpen(product)}
            accessibilityRole="button"
            accessibilityLabel={`View ${product.name}`}
            style={{ width }}
            className={`overflow-hidden rounded-2xl border border-slate-200 bg-white ${product.sold_out ? 'opacity-70' : ''}`}
        >
            <View
                style={{ width, height: width }}
                className="items-center justify-center bg-slate-100"
            >
                {product.photo_url ? (
                    <Image
                        source={{ uri: product.photo_url }}
                        style={{ width, height: width }}
                        resizeMode="cover"
                    />
                ) : (
                    <ImageIcon size={compact ? 24 : 32} color="#cbd5e1" />
                )}

                {onSale && !product.sold_out && (
                    <View
                        className={`absolute rounded-lg bg-red-500 ${compact ? 'left-1.5 top-1.5 px-1.5 py-0.5' : 'left-2 top-2 px-2 py-1'}`}
                    >
                        <Text className="font-sans-bold text-[10px] text-white">
                            SALE
                        </Text>
                    </View>
                )}

                {!compact && onSale && !product.sold_out && product.sale_ends_at && (
                    <View className="absolute right-2 top-2 rounded-lg bg-white/95 px-2 py-1">
                        <Text className="font-sans-bold text-[10px] text-red-600">
                            {saleEndsText(product.sale_ends_at)}
                        </Text>
                    </View>
                )}

                {comingSoon && (
                    <View className="absolute left-2 top-2 rounded-lg bg-amber-400 px-2 py-1">
                        <Text className="font-sans-bold text-[10px] text-amber-950">
                            COMING SOON
                        </Text>
                    </View>
                )}

                {product.almost_sold_out && product.pieces_left !== null && (
                    <View
                        className={`absolute rounded-lg bg-orange-500 ${compact ? 'bottom-1.5 left-1.5 px-1.5 py-0.5' : 'bottom-2 left-2 px-2 py-1'}`}
                    >
                        <Text className="font-sans-bold text-[10px] text-white">
                            Only {product.pieces_left} left
                        </Text>
                    </View>
                )}

                {product.sold_out && (
                    <View className="absolute inset-0 items-center justify-center bg-slate-900/40">
                        <View className="rounded-lg bg-slate-900 px-3 py-1.5">
                            <Text className="font-sans-bold text-xs tracking-wide text-white">
                                OUT OF STOCK
                            </Text>
                        </View>
                    </View>
                )}
            </View>

            {compact ? (
                <View className="flex-1 gap-1 p-2">
                    <Text
                        numberOfLines={2}
                        className="font-sans-semibold text-xs text-slate-900"
                    >
                        {product.name}
                    </Text>
                    <PriceLines price={product.price} small />
                    {onSale && !product.sold_out && product.sale_ends_at && (
                        <Text className="mt-auto font-sans-bold text-[10px] text-red-600">
                            {saleEndsText(product.sale_ends_at)}
                        </Text>
                    )}
                </View>
            ) : (
                <View className="flex-1 gap-2 p-3">
                    <Text
                        numberOfLines={2}
                        className="font-sans-semibold text-sm text-slate-900"
                    >
                        {product.name}
                    </Text>

                    <PriceLines price={product.price} />

                    {comingSoon && product.preorders_close_on && (
                        <Text className="font-sans-bold text-[11px] text-amber-700">
                            {product.accepts_preorders
                                ? `Preorder until ${formatDate(product.preorders_close_on)}`
                                : 'Preorders closed'}
                        </Text>
                    )}

                    <View className="mt-auto">
                        {product.sold_out ? (
                            <View className="items-center rounded-xl bg-slate-100 py-2">
                                <Text className="font-sans-bold text-xs text-slate-500">
                                    Out of stock
                                </Text>
                            </View>
                        ) : comingSoon && !product.accepts_preorders ? (
                            <View className="items-center rounded-xl bg-slate-100 py-2">
                                <Text className="font-sans-bold text-xs text-slate-500">
                                    Preorders closed
                                </Text>
                            </View>
                        ) : (
                            <View
                                className={`flex-row items-center justify-center gap-1.5 rounded-xl py-2 ${comingSoon ? 'bg-amber-400' : 'bg-brand'}`}
                            >
                                {comingSoon ? (
                                    <CalendarClock size={14} color="#451a03" />
                                ) : (
                                    <ShoppingCart size={14} color="#ffffff" />
                                )}
                                <Text
                                    className={`font-sans-bold text-xs ${comingSoon ? 'text-amber-950' : 'text-white'}`}
                                >
                                    {comingSoon ? 'Preorder' : 'Add to Cart'}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            )}
        </Pressable>
    );
}
