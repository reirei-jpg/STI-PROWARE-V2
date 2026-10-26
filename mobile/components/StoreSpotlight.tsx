import { ChevronLeft, ChevronRight, ImageIcon, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';

import PriceLines, { saleEndsText } from '@/components/PriceLines';
import type { StorefrontSpotlightItem, StorefrontTileProduct } from '@/lib/types';

/** How long each item shows before the next one slides in. */
const SLIDE_MS = 4000;

/** Shown once each time the app is opened, not each time Home comes back. */
let shownThisLaunch = false;

/**
 * The store pop-up, like an ad (the website's StoreSpotlight): the first
 * time Home loads after the app opens, it shows the products that came back
 * in stock or are on sale, one at a time with a big photo, sliding to the
 * next by itself (the dots and arrows switch too). View opens the product;
 * X, Back or tapping outside hides it until the app is opened again. Nothing shows
 * when there is nothing back in stock or on sale.
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
    const cardWidth = Math.min(width - 40, 420);
    const view = (): void => {
        setOpen(false);
        onOpen(product);
    };
    const go = (step: number): void => setIndex((current) => (current + step + count) % count);

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
                    className="absolute inset-0 bg-black/60"
                />
                <View style={{ width: cardWidth }} className="overflow-hidden rounded-3xl bg-white">
                    <View className="flex-row items-center justify-between gap-3 px-5 pb-3 pt-4">
                        <View className="flex-1">
                            <Text className="font-sans-bold text-lg text-slate-900">New in the store</Text>
                            <Text className="font-sans text-xs text-slate-500">
                                Back in stock and on sale at the PROWARE office.
                            </Text>
                        </View>
                        <Pressable
                            onPress={() => setOpen(false)}
                            accessibilityRole="button"
                            accessibilityLabel="Close"
                            hitSlop={10}
                            className="h-9 w-9 items-center justify-center rounded-xl"
                        >
                            <X size={20} color="#94a3b8" />
                        </Pressable>
                    </View>

                    <Pressable onPress={view} accessibilityRole="button" accessibilityLabel={`View ${product.name}`}>
                        <View
                            style={{ width: cardWidth, height: Math.round((cardWidth * 3) / 4) }}
                            className="items-center justify-center bg-slate-100"
                        >
                            {product.photo_url ? (
                                <Image
                                    source={{ uri: product.photo_url }}
                                    style={{ width: cardWidth, height: Math.round((cardWidth * 3) / 4) }}
                                    resizeMode="cover"
                                />
                            ) : (
                                <ImageIcon size={40} color="#cbd5e1" />
                            )}
                            <View
                                className={`absolute left-3 top-3 rounded-lg px-2.5 py-1 ${backInStock ? 'bg-emerald-600' : 'bg-red-500'}`}
                            >
                                <Text className="font-sans-bold text-[11px] tracking-wide text-white">
                                    {backInStock ? 'BACK IN STOCK' : 'SALE'}
                                </Text>
                            </View>
                            {!backInStock && product.sale_ends_at && (
                                <View className="absolute right-3 top-3 rounded-lg bg-white/95 px-2.5 py-1">
                                    <Text className="font-sans-bold text-[11px] text-red-600">
                                        {saleEndsText(product.sale_ends_at)}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </Pressable>

                    <View className="gap-3 px-5 pb-5 pt-4">
                        <View className="gap-1">
                            <Text className="font-sans-bold text-base text-slate-900">{product.name}</Text>
                            {backInStock && item.back_in_stock.length > 0 && (
                                <Text className="font-sans-semibold text-sm text-emerald-700">
                                    Back in stock: {item.back_in_stock.join(', ')}
                                </Text>
                            )}
                            <PriceLines price={product.price} />
                        </View>

                        <View className="flex-row items-center justify-between gap-3">
                            {count > 1 ? (
                                <View className="flex-row items-center gap-1">
                                    <Pressable
                                        onPress={() => go(-1)}
                                        accessibilityRole="button"
                                        accessibilityLabel="Previous item"
                                        className="h-9 w-9 items-center justify-center rounded-lg border border-slate-200"
                                    >
                                        <ChevronLeft size={16} color="#475569" />
                                    </Pressable>
                                    <View className="flex-row items-center gap-1.5 px-1">
                                        {items?.map((entry, dot) => (
                                            <Pressable
                                                key={entry.product.id}
                                                onPress={() => setIndex(dot)}
                                                accessibilityRole="button"
                                                accessibilityLabel={`Show ${entry.product.name}`}
                                                hitSlop={6}
                                                className={`h-2 rounded-full ${dot === index ? 'w-5 bg-brand' : 'w-2 bg-slate-300'}`}
                                            />
                                        ))}
                                    </View>
                                    <Pressable
                                        onPress={() => go(1)}
                                        accessibilityRole="button"
                                        accessibilityLabel="Next item"
                                        className="h-9 w-9 items-center justify-center rounded-lg border border-slate-200"
                                    >
                                        <ChevronRight size={16} color="#475569" />
                                    </Pressable>
                                </View>
                            ) : (
                                <View />
                            )}
                            <Pressable
                                onPress={view}
                                accessibilityRole="button"
                                className="rounded-xl bg-brand px-5 py-2.5"
                            >
                                <Text className="font-sans-bold text-sm text-white">View</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
