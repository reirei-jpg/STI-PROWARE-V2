import { router, useLocalSearchParams } from 'expo-router';
import {
    ArrowLeft,
    CalendarClock,
    CircleCheck,
    ImageIcon,
    ShoppingCart,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Pressable,
    ScrollView,
    Text,
    View,
    useWindowDimensions,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AddToCartSheet from '@/components/AddToCartSheet';
import PreorderSheet from '@/components/PreorderSheet';
import PriceLines, { saleEndsText } from '@/components/PriceLines';
import { takesPreorders } from '@/components/ProductTile';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatPeso } from '@/lib/format';
import { choiceIsOpen } from '@/lib/option-picker';
import type { StorefrontProductDetails } from '@/lib/types';


/**
 * One product, like the website's product view: its photos (swipe), the
 * price per piece and per pack, and each option's choices (crossed out when
 * none are left; those can be preordered). Add to Cart or Preorder stays at
 * the bottom and opens its picker; a product sold out in every size offers
 * Preorder while it can be preordered.
 */
export default function ProductScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const { request } = useAuth();
    const [product, setProduct] = useState<StorefrontProductDetails | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [photoIndex, setPhotoIndex] = useState(0);
    const [picking, setPicking] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    // The last thing done was a preorder (it shows "See My Preorders").
    const [preordered, setPreordered] = useState(false);

    const load = useCallback(
        () =>
            request<StorefrontProductDetails>(`/products/${id}`)
                .then(setProduct)
                .catch((caught) =>
                    setError(
                        caught instanceof ApiError && caught.status === 404
                            ? 'This item is no longer in the store.'
                            : 'The item could not be loaded. Go back and try again.',
                    ),
                ),
        [id, request],
    );

    useEffect(() => {
        void load();
    }, [load]);

    const done = (message: string, wasPreorder: boolean): void => {
        setPicking(false);
        setNotice(message);
        setPreordered(wasPreorder);
        // The stock may have changed since the page opened.
        void load();
    };

    const comingSoon = product?.status === 'preorder';
    // Coming Soon, or out of stock in every size with sizes to preorder.
    const preorderOnly = product !== null && takesPreorders(product);
    const photos =
        product === null
            ? []
            : product.photos.length > 0
              ? product.photos
              : product.photo_url
                ? [{ url: product.photo_url, label: null }]
                : [];
    const hasOptions =
        product !== null && (product.variants.length > 1 || product.options.length > 0);

    const onPhotoSwipe = (event: NativeSyntheticEvent<NativeScrollEvent>): void =>
        setPhotoIndex(Math.round(event.nativeEvent.contentOffset.x / width));

    return (
        <View className="flex-1 bg-page">
            <ScrollView
                contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 24 }}
            >
                <Pressable
                    onPress={() => router.back()}
                    accessibilityRole="button"
                    className="mx-4 mb-3 flex-row items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 py-2"
                >
                    <ArrowLeft size={17} color="#334155" />
                    <Text className="font-sans-bold text-sm text-slate-700">Back</Text>
                </Pressable>

                {error ? (
                    <Text className="mx-4 font-sans-semibold text-sm text-red-600">{error}</Text>
                ) : product === null ? (
                    <ActivityIndicator color="#0D6EFD" className="mt-10" />
                ) : (
                    <View>
                        <View style={{ width, height: width }} className="bg-slate-100">
                            {photos.length > 0 ? (
                                <ScrollView
                                    horizontal
                                    pagingEnabled
                                    showsHorizontalScrollIndicator={false}
                                    onMomentumScrollEnd={onPhotoSwipe}
                                >
                                    {photos.map((photo) => (
                                        <Image
                                            key={photo.url}
                                            source={{ uri: photo.url }}
                                            accessibilityLabel={photo.label ?? product.name}
                                            style={{
                                                width,
                                                height: width,
                                                opacity: product.sold_out ? 0.6 : 1,
                                            }}
                                            resizeMode="cover"
                                        />
                                    ))}
                                </ScrollView>
                            ) : (
                                <View className="flex-1 items-center justify-center">
                                    <ImageIcon size={48} color="#cbd5e1" />
                                </View>
                            )}

                            {photos.length > 1 && (
                                <View className="absolute bottom-3 right-3 rounded-full bg-black/50 px-3 py-1">
                                    <Text className="font-sans-bold text-xs text-white">
                                        {photoIndex + 1} / {photos.length}
                                    </Text>
                                </View>
                            )}
                        </View>

                        <View className="gap-4 px-4 pt-4">
                            {notice && (
                                <View className="gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                                    <View className="flex-row items-start gap-2">
                                        <CircleCheck size={18} color="#047857" />
                                        <Text className="flex-1 font-sans-semibold text-sm text-emerald-800">
                                            {notice}
                                        </Text>
                                    </View>
                                    <Pressable
                                        onPress={() =>
                                            router.navigate(
                                                preordered ? '/orders?show=preorders' : '/cart',
                                            )
                                        }
                                        accessibilityRole="button"
                                        className="flex-row items-center justify-center gap-2 self-start rounded-xl border border-emerald-300 bg-white px-4 py-2.5"
                                    >
                                        {preordered ? (
                                            <CalendarClock size={16} color="#047857" />
                                        ) : (
                                            <ShoppingCart size={16} color="#047857" />
                                        )}
                                        <Text className="font-sans-bold text-sm text-emerald-800">
                                            {preordered ? 'See My Preorders' : 'View Cart'}
                                        </Text>
                                    </Pressable>
                                </View>
                            )}

                            <View className="gap-1">
                                <Text className="font-sans-bold text-2xl text-slate-900">
                                    {product.name}
                                </Text>
                                <Text className="font-sans text-sm text-slate-500">
                                    {comingSoon
                                        ? 'Coming soon · preorder it now'
                                        : product.sold_out
                                          ? product.accepts_preorders
                                              ? 'Out of stock · preorder it to be notified when it is back'
                                              : 'Out of stock for now'
                                          : product.sale_ends_at
                                            ? `On sale · ${saleEndsText(product.sale_ends_at).toLowerCase()}`
                                            : 'Official STI merchandise'}
                                </Text>
                            </View>

                            <PriceLines price={product.price} large />

                            {product.almost_sold_out && product.pieces_left !== null && (
                                <View className="self-start rounded-lg bg-orange-100 px-3 py-1.5">
                                    <Text className="font-sans-bold text-sm text-orange-800">
                                        Almost sold out · Only {product.pieces_left} left
                                    </Text>
                                </View>
                            )}

                            {comingSoon && product.preorders_close_on && (
                                <Text className="font-sans-bold text-sm text-amber-700">
                                    {product.accepts_preorders
                                        ? `Preorder until ${formatDate(product.preorders_close_on)}`
                                        : `Preorders closed on ${formatDate(product.preorders_close_on)}`}
                                </Text>
                            )}
                            {comingSoon && product.expected_arrival && (
                                <Text className="font-sans-semibold text-sm text-slate-700">
                                    Expected to arrive {product.expected_arrival}
                                </Text>
                            )}
                            {comingSoon && product.early_bird && (
                                <Text className="font-sans-bold text-sm text-red-600">
                                    {product.early_bird.pieces_left > 0
                                        ? `Early bird: ${formatPeso(product.early_bird.price_centavos)} each for the first ${product.early_bird.pieces} pcs (${product.early_bird.pieces_left} left)`
                                        : `The ${product.early_bird.pieces} early-bird pieces are all taken.`}
                                </Text>
                            )}

                            {hasOptions && (
                                <View className="gap-3">
                                    {product.options.map((option) => (
                                        <View key={option.name} className="gap-1.5">
                                            <Text className="font-sans-bold text-sm text-slate-700">
                                                {option.name}
                                            </Text>
                                            <View className="flex-row flex-wrap gap-2">
                                                {option.choices.map((choice) => {
                                                    const inStock = choiceIsOpen(
                                                        product.variants,
                                                        {},
                                                        option.name,
                                                        choice,
                                                        (variant) => variant.availability !== 'sold_out',
                                                    );

                                                    return (
                                                        <View
                                                            key={choice}
                                                            className={`rounded-lg border px-3 py-1.5 ${inStock ? 'border-slate-200 bg-white' : 'border-dashed border-slate-200 bg-slate-50'}`}
                                                        >
                                                            <Text
                                                                className={`font-sans-semibold text-sm ${inStock ? 'text-slate-700' : 'text-slate-400 line-through'}`}
                                                            >
                                                                {choice}
                                                            </Text>
                                                        </View>
                                                    );
                                                })}
                                            </View>
                                        </View>
                                    ))}
                                    <Text className="font-sans text-xs text-slate-500">
                                        {preorderOnly
                                            ? 'Choose yours when you tap Preorder.'
                                            : 'Choose yours when you tap Add to Cart. Crossed out means none are left; you can preorder those there.'}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                )}
            </ScrollView>

            {product && (
                <View
                    style={{ paddingBottom: insets.bottom + 12 }}
                    className="border-t border-slate-200 bg-white px-4 pt-3"
                >
                    {product.sold_out && !product.accepts_preorders ? (
                        <ClosedBar>Out of stock for now</ClosedBar>
                    ) : comingSoon && !product.accepts_preorders ? (
                        <ClosedBar>Preorders closed</ClosedBar>
                    ) : (
                        <Pressable
                            onPress={() => setPicking(true)}
                            accessibilityRole="button"
                            className={`flex-row items-center justify-center gap-2 rounded-2xl py-4 ${preorderOnly ? 'bg-amber-400' : 'bg-brand'}`}
                        >
                            {preorderOnly ? (
                                <CalendarClock size={18} color="#451a03" />
                            ) : (
                                <ShoppingCart size={18} color="#ffffff" />
                            )}
                            <Text
                                className={`font-sans-bold text-base ${preorderOnly ? 'text-amber-950' : 'text-white'}`}
                            >
                                {preorderOnly ? 'Preorder' : 'Add to Cart'}
                            </Text>
                        </Pressable>
                    )}
                </View>
            )}

            {product &&
                (preorderOnly ? (
                    <PreorderSheet
                        product={product}
                        open={picking}
                        onClose={() => setPicking(false)}
                        onPlaced={(message) => done(message, true)}
                    />
                ) : (
                    <AddToCartSheet
                        product={product}
                        open={picking}
                        onClose={() => setPicking(false)}
                        onAdded={done}
                    />
                ))}
        </View>
    );
}

function ClosedBar({ children }: { children: React.ReactNode }) {
    return (
        <View className="items-center rounded-2xl bg-slate-100 py-4">
            <Text className="font-sans-bold text-base text-slate-500">{children}</Text>
        </View>
    );
}
