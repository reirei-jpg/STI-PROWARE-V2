import { router, useLocalSearchParams } from 'expo-router';
import {
    ArrowLeft,
    CalendarClock,
    CircleCheck,
    Heart,
    ImageIcon,
    ShoppingCart,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
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
import LoadError from '@/components/LoadError';
import LoadingState from '@/components/LoadingState';
import PreorderSheet from '@/components/PreorderSheet';
import OptionRow from '@/components/OptionRow';
import PriceLines, { saleEndsText } from '@/components/PriceLines';
import { takesPreorders } from '@/components/ProductTile';
import { stockLeft } from '@/components/StockLeft';
import { ApiError, loadErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatPeso, formatUnits } from '@/lib/format';
import { pickChoice, pickedVariant, startingPicks, type Picked } from '@/lib/option-picker';
import type { StorefrontProductDetails } from '@/lib/types';

const anyVariant = (): boolean => true;
const isSoldOut = (variant: { availability: string }): boolean => variant.availability === 'sold_out';


/**
 * One product, like the website's product view: its photos (swipe), the
 * price per piece and per pack, and each option's choices (crossed out when
 * none are left; those can be preordered). Add to Cart or Preorder stays at
 * the bottom and opens its picker; a product sold out in every size offers
 * Preorder while it can be preordered.
 */
export default function ProductScreen() {
    // From My Wishlist: open the Add to Cart (or Preorder) sheet at once,
    // with the saved size or color chosen.
    const { id, add, variant: savedVariant } = useLocalSearchParams<{ id: string; add?: string; variant?: string }>();
    const startVariantId = savedVariant ? Number(savedVariant) : null;
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const { user, request } = useAuth();
    const [product, setProduct] = useState<StorefrontProductDetails | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [photoIndex, setPhotoIndex] = useState(0);
    const [picking, setPicking] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    // What the last step did, for the link under its message (View Cart,
    // See My Preorders, See My Wishlist).
    const [doneKind, setDoneKind] = useState<'cart' | 'preorder' | 'wishlist'>('cart');

    const load = useCallback(
        () =>
            request<StorefrontProductDetails>(`/products/${id}`)
                .then((loaded) => {
                    setProduct(loaded);
                    setError(null);
                })
                .catch((caught) =>
                    setError(
                        caught instanceof ApiError && caught.status === 404
                            ? 'This item is no longer in the store.'
                            : loadErrorMessage(caught, 'The item could not be loaded.'),
                    ),
                ),
        [id, request],
    );

    useEffect(() => {
        void load();
    }, [load]);

    // Opened from My Wishlist's Add to Cart: once the item is loaded.
    const [openedFromWishlist, setOpenedFromWishlist] = useState(false);

    useEffect(() => {
        if (add === '1' && product !== null && user !== null && !openedFromWishlist) {
            setOpenedFromWishlist(true);
            setPicking(true);
        }
    }, [add, product, user, openedFromWishlist]);

    const done = (message: string, kind: 'cart' | 'preorder' | 'wishlist'): void => {
        setPicking(false);
        setNotice(message);
        setDoneKind(kind);
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
    // The size or color tapped, to show how many of it are left (an option
    // with one choice counts as tapped).
    const [tapped, setTapped] = useState<Picked>({});
    const picked: Picked = product === null ? {} : { ...startingPicks(product.variants, anyVariant), ...tapped };
    const pickedOne = product === null ? undefined : pickedVariant(product.variants, product.options, picked);

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

                {error && product === null ? (
                    <LoadError message={error} onRetry={load} />
                ) : product === null ? (
                    <LoadingState />
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
                                            doneKind === 'wishlist'
                                                ? router.push('/wishlist')
                                                : router.navigate(
                                                      doneKind === 'preorder' ? '/orders?show=preorders' : '/cart',
                                                  )
                                        }
                                        accessibilityRole="button"
                                        className="flex-row items-center justify-center gap-2 self-start rounded-xl border border-emerald-300 bg-white px-4 py-2.5"
                                    >
                                        {doneKind === 'preorder' ? (
                                            <CalendarClock size={16} color="#047857" />
                                        ) : doneKind === 'wishlist' ? (
                                            <Heart size={16} color="#047857" />
                                        ) : (
                                            <ShoppingCart size={16} color="#047857" />
                                        )}
                                        <Text className="font-sans-bold text-sm text-emerald-800">
                                            {doneKind === 'preorder'
                                                ? 'See My Preorders'
                                                : doneKind === 'wishlist'
                                                  ? 'See My Wishlist'
                                                  : 'View Cart'}
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
                                          ? product.available_soon
                                              ? product.accepts_preorders
                                                  ? 'Available soon · preorder it to be first'
                                                  : 'Available soon'
                                              : product.accepts_preorders
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

                            <View className="gap-3">
                                {hasOptions &&
                                    product.options.map((option) => (
                                        <OptionRow
                                            key={option.name}
                                            option={option}
                                            picked={picked}
                                            variants={product.variants}
                                            canPick={anyVariant}
                                            isOut={comingSoon ? undefined : isSoldOut}
                                            onPick={(choice) =>
                                                setTapped(
                                                    pickChoice(
                                                        product.variants,
                                                        product.options,
                                                        picked,
                                                        option.name,
                                                        choice,
                                                        anyVariant,
                                                    ),
                                                )
                                            }
                                        />
                                    ))}
                                {!comingSoon &&
                                    (pickedOne ? (
                                        <Text className={`font-sans-bold text-sm ${stockLeft(pickedOne).tone}`}>
                                            {hasOptions ? `${pickedOne.label}: ` : ''}
                                            {stockLeft(pickedOne).text}
                                        </Text>
                                    ) : (
                                        <Text className="font-sans text-sm text-slate-500">
                                            Tap a{' '}
                                            {product.options.map((option) => option.name.toLowerCase()).join(' and ')}{' '}
                                            to see how many are left.
                                        </Text>
                                    ))}
                                {product.most_per_buyer != null && (
                                    <View className="self-start rounded-lg bg-slate-100 px-3 py-1.5">
                                        <Text className="font-sans-bold text-sm text-slate-700">
                                            Limit: {formatUnits(product.most_per_buyer, 'Piece')} per buyer, so more
                                            buyers get one
                                        </Text>
                                    </View>
                                )}
                                {hasOptions && (
                                    <Text className="font-sans text-xs text-slate-500">
                                        {preorderOnly
                                            ? 'Choose yours when you tap Preorder.'
                                            : 'Crossed out means none are left; you can preorder those when you tap Add to Cart.'}
                                    </Text>
                                )}
                            </View>
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
                        <ClosedBar>{product.available_soon ? 'Available soon' : 'Out of stock for now'}</ClosedBar>
                    ) : comingSoon && !product.accepts_preorders ? (
                        <ClosedBar>Preorders closed</ClosedBar>
                    ) : (
                        <Pressable
                            // Browsing needs no account; adding or preordering does.
                            // After signing in, the student is back on this item.
                            onPress={() => (user ? setPicking(true) : router.push('/login'))}
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
                        onPlaced={(message) => done(message, 'preorder')}
                    />
                ) : (
                    <AddToCartSheet
                        product={product}
                        open={picking}
                        startVariantId={startVariantId}
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
