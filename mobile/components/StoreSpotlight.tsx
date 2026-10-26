import { ImageIcon, Sparkles, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';

import { saleEndsText } from '@/components/PriceLines';
import { formatPeso } from '@/lib/format';
import type { StorefrontPrice, StorefrontSpotlightItem, StorefrontTileProduct } from '@/lib/types';

/** How long each item shows before the next one slides in. */
const SLIDE_MS = 4000;

/** Shown once each time the app is opened, not each time Home comes back. */
let shownThisLaunch = false;

/**
 * The store pop-up, like an ad, in a soft card over a lightly dimmed screen
 * (the website's StoreSpotlight): the first time Home loads after the app
 * opens, it shows the products that came back in stock or are on sale, one
 * at a time with a big photo, moving to the next by itself (the dots switch
 * too). View item opens the product; X, Maybe later, Back or tapping outside
 * hides it until the app is opened again. Nothing shows when there is
 * nothing back in stock or on sale.
 */
export default function StoreSpotlight({
    items,
    onOpen,
}: {
    items: StorefrontSpotlightItem[] | null;
    onOpen: (product: StorefrontTileProduct) => void;
}) {
    const { width } = useWindowDimensions();
    const [open, setOpen] = useState(false);
    const [index, setIndex] = useState(0);

    useEffect(() => {
        if (items !== null && items.length > 0 && !shownThisLaunch) {
            shownThisLaunch = true;
            setOpen(true);
        }
    }, [items]);

    const count = items?.length ?? 0;

    useEffect(() => {
        if (!open || count < 2) {
            return;
        }

        const timer = setInterval(() => setIndex((current) => (current + 1) % count), SLIDE_MS);

        return () => clearInterval(timer);
    }, [open, count, index]);

    const item = items?.[Math.min(index, count - 1)];

    if (!item) {
        return null;
    }

    const { product } = item;
    const backInStock = item.reason === 'back_in_stock';
    const cardWidth = Math.min(width - 40, 400);
    const view = (): void => {
        setOpen(false);
        onOpen(product);
    };

    return (
        <Modal
            visible={open}
            transparent
            animationType="fade"
            onRequestClose={() => setOpen(false)}
            statusBarTranslucent
        >
            <View className="flex-1 items-center justify-center px-5">
                <Pressable
                    onPress={() => setOpen(false)}
                    accessibilityLabel="Close"
                    className="absolute inset-0 bg-black/30"
                />
                <View style={{ width: cardWidth }} className="rounded-[28px] bg-white p-5">
                    <View className="flex-row items-start justify-between gap-3">
                        <View className="flex-1 flex-row items-center gap-3">
                            <View className="h-9 w-9 items-center justify-center rounded-full bg-blue-50">
                                <Sparkles size={17} color="#0D6EFD" />
                            </View>
                            <View className="flex-1">
                                <Text className="font-sans-bold text-base text-slate-800">New in the store</Text>
                                <Text className="font-sans text-xs text-slate-400">Back in stock and on sale</Text>
                            </View>
                        </View>
                        <Pressable
                            onPress={() => setOpen(false)}
                            accessibilityRole="button"
                            accessibilityLabel="Close"
                            hitSlop={8}
                            className="h-8 w-8 items-center justify-center rounded-full bg-slate-100"
                        >
                            <X size={16} color="#64748b" />
                        </Pressable>
                    </View>

                    <Pressable
                        onPress={view}
                        accessibilityRole="button"
                        accessibilityLabel={`View ${product.name}`}
                        className="mt-4 overflow-hidden rounded-2xl bg-slate-50"
                    >
                        <View style={{ width: '100%', aspectRatio: 4 / 3 }} className="items-center justify-center">
                            {product.photo_url ? (
                                <Image
                                    source={{ uri: product.photo_url }}
                                    style={{ width: '100%', height: '100%' }}
                                    resizeMode="cover"
                                />
                            ) : (
                                <ImageIcon size={40} color="#cbd5e1" />
                            )}
                        </View>
                    </Pressable>

                    <View className="mt-4 flex-row flex-wrap items-center gap-2">
                        <View
                            className={`rounded-full border px-2.5 py-1 ${backInStock ? 'border-emerald-100 bg-emerald-50' : 'border-rose-100 bg-rose-50'}`}
                        >
                            <Text
                                className={`font-sans-semibold text-xs ${backInStock ? 'text-emerald-700' : 'text-rose-600'}`}
                            >
                                {backInStock ? 'Back in stock' : 'On sale'}
                            </Text>
                        </View>
                        <Text className="font-sans text-xs text-slate-500">
                            {backInStock
                                ? item.back_in_stock.join(', ')
                                : product.sale_ends_at
                                  ? saleEndsText(product.sale_ends_at)
                                  : ''}
                        </Text>
                    </View>

                    <Text className="mt-2 font-sans-bold text-lg text-slate-800">{product.name}</Text>
                    <SoftPrice price={product.price} />

                    <Pressable
                        onPress={view}
                        accessibilityRole="button"
                        className="mt-5 items-center rounded-2xl bg-brand py-3"
                    >
                        <Text className="font-sans-semibold text-sm text-white">View item</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => setOpen(false)}
                        accessibilityRole="button"
                        className="mt-1 items-center rounded-2xl py-2.5"
                    >
                        <Text className="font-sans-medium text-sm text-slate-400">Maybe later</Text>
                    </Pressable>

                    {count > 1 && (
                        <View className="mt-1 flex-row items-center justify-center gap-1.5">
                            {items?.map((entry, dot) => (
                                <Pressable
                                    key={entry.product.id}
                                    onPress={() => setIndex(dot)}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Show ${entry.product.name}`}
                                    hitSlop={8}
                                    className={`h-1.5 rounded-full ${dot === index ? 'w-5 bg-blue-500' : 'w-1.5 bg-slate-200'}`}
                                />
                            ))}
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
}

/**
 * The price in the store's blue: the sale price beside the crossed-out
 * normal price, or the pack price for items sold only by the pack.
 */
function SoftPrice({ price }: { price: StorefrontPrice }) {
    const pack = price.packs[0];
    const normal = price.piece_centavos ?? pack?.price_centavos ?? null;
    const sale = price.piece_centavos !== null ? price.sale_centavos : (pack?.sale_price_centavos ?? null);
    const unit = price.piece_centavos !== null || !pack ? '/ pc' : `/ ${pack.name} of ${pack.pieces}`;

    if (normal === null) {
        return null;
    }

    return (
        <View className="mt-1 flex-row flex-wrap items-baseline gap-x-2">
            {price.piece_from && <Text className="font-sans text-xs text-slate-400">From</Text>}
            {sale !== null && (
                <Text className="font-sans text-sm text-slate-400 line-through">{formatPeso(normal)}</Text>
            )}
            <Text className="font-sans-bold text-xl text-blue-600">{formatPeso(sale ?? normal)}</Text>
            <Text className="font-sans text-xs text-slate-400">{unit}</Text>
        </View>
    );
}
