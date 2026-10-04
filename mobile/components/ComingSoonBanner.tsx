import { CalendarDays, Megaphone } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
    Image,
    Pressable,
    ScrollView,
    Text,
    View,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
} from 'react-native';

import PriceLines from '@/components/PriceLines';
import { formatDate } from '@/lib/format';
import type { StorefrontTileProduct } from '@/lib/types';

/** Compact, like V1's approved strip: the photo left, the blue panel right. */
const CARD_HEIGHT = 220;
const IMAGE_SHARE = 0.4;
const ROTATE_EVERY_MS = 5000;

/**
 * Coming Soon for a phone (as approved in V1): one upcoming item at a time
 * in a compact strip. It turns to the next item every 5 seconds and back to
 * the first after the last, never while a finger is on it, and can be
 * swiped. Dots show where you are.
 */
export default function ComingSoonBanner({
    products,
    width,
    onOpen,
}: {
    products: StorefrontTileProduct[];
    width: number;
    onOpen: (product: StorefrontTileProduct) => void;
}) {
    const scroller = useRef<ScrollView>(null);
    const [index, setIndex] = useState(0);
    const [isTouching, setIsTouching] = useState(false);

    const count = products.length;
    const imageWidth = Math.round(width * IMAGE_SHARE);

    const goTo = (target: number): void => {
        const next = ((target % count) + count) % count;

        setIndex(next);
        scroller.current?.scrollTo({ x: next * width, animated: true });
    };

    // Keep the position valid if the list gets shorter.
    useEffect(() => {
        if (index >= count) {
            setIndex(0);
            scroller.current?.scrollTo({ x: 0, animated: false });
        }
    }, [index, count]);

    useEffect(() => {
        if (isTouching || count <= 1) {
            return;
        }

        const timer = setTimeout(() => goTo(index + 1), ROTATE_EVERY_MS);

        return () => clearTimeout(timer);
        // goTo only depends on what is listed here.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isTouching, index, count, width]);

    const onSwipeEnd = (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
        setIndex(
            Math.min(
                count - 1,
                Math.max(0, Math.round(event.nativeEvent.contentOffset.x / width)),
            ),
        );
    };

    if (count === 0) {
        return null;
    }

    return (
        <View
            style={{ width, height: CARD_HEIGHT }}
            onTouchStart={() => setIsTouching(true)}
            onTouchEnd={() => setIsTouching(false)}
            onTouchCancel={() => setIsTouching(false)}
            className="overflow-hidden rounded-3xl border border-blue-100 bg-white"
        >
            <ScrollView
                ref={scroller}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={onSwipeEnd}
                scrollEnabled={count > 1}
            >
                {products.map((product) => (
                    <Pressable
                        key={product.id}
                        onPress={() => onOpen(product)}
                        // Preorders closed: still shown, but nothing to open.
                        disabled={!product.accepts_preorders}
                        accessibilityRole="button"
                        accessibilityLabel={
                            product.accepts_preorders
                                ? product.name
                                : `${product.name}, preorders closed`
                        }
                        accessibilityState={{ disabled: !product.accepts_preorders }}
                        style={{ width, height: CARD_HEIGHT }}
                        className="flex-row"
                    >
                        <View
                            style={{ width: imageWidth, height: CARD_HEIGHT }}
                            className="bg-slate-100"
                        >
                            {product.photo_url ? (
                                <Image
                                    source={{ uri: product.photo_url }}
                                    style={{ width: imageWidth, height: CARD_HEIGHT }}
                                    resizeMode="cover"
                                />
                            ) : (
                                <View className="flex-1 items-center justify-center bg-blue-50">
                                    <Megaphone size={36} color="#3b82f6" />
                                </View>
                            )}

                            <View className="absolute left-2 top-2 rounded-full bg-amber-400 px-2.5 py-1">
                                <Text className="font-sans-bold text-[9px] uppercase tracking-wide text-slate-900">
                                    Coming Soon
                                </Text>
                            </View>
                        </View>

                        <View
                            style={{ width: width - imageWidth, height: CARD_HEIGHT }}
                            className="justify-center gap-2 bg-blue-700 px-4 pb-8 pt-4"
                        >
                            <Text className="font-sans-bold text-[9px] uppercase tracking-[1.5px] text-yellow-300">
                                Upcoming Merchandise
                            </Text>

                            <Text
                                numberOfLines={2}
                                className="font-sans-bold text-lg leading-6 text-white"
                            >
                                {product.name}
                            </Text>

                            <View className="self-start rounded-xl bg-white px-2.5 py-1.5">
                                <PriceLines price={product.price} />
                            </View>

                            {product.preorders_close_on && (
                                <View className="flex-row items-center gap-1.5">
                                    <CalendarDays size={12} color="#dbeafe" />
                                    <Text
                                        numberOfLines={1}
                                        className="flex-1 font-sans-semibold text-[11px] text-blue-100"
                                    >
                                        {product.accepts_preorders
                                            ? `Preorder until ${formatDate(product.preorders_close_on)}`
                                            : 'Preorders closed'}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </Pressable>
                ))}
            </ScrollView>

            {count > 1 && (
                <View
                    style={{ bottom: 10, left: 0, right: 0 }}
                    className="absolute flex-row items-center justify-center"
                    pointerEvents="none"
                >
                    <View className="flex-row items-center gap-1.5 rounded-full bg-black/20 px-2.5 py-1.5">
                        {products.map((product, position) => (
                            <View
                                key={product.id}
                                className={`h-1.5 rounded-full ${position === index ? 'w-4 bg-white' : 'w-1.5 bg-white/60'}`}
                            />
                        ))}
                    </View>
                </View>
            )}
        </View>
    );
}
