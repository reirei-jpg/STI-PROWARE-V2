import { CalendarClock, ShoppingCart } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';

import BottomSheet from '@/components/BottomSheet';
import ChoiceChip from '@/components/ChoiceChip';
import OptionRow from '@/components/OptionRow';
import QuantityStepper from '@/components/QuantityStepper';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { formatPeso, formatUnits, unitWord } from '@/lib/format';
import { pickChoice, pickedVariant, startingPicks, type Picked } from '@/lib/option-picker';
import type { CartView, StorefrontProductDetails } from '@/lib/types';

/**
 * Add to Cart, like the website's picker: size or color, by the piece or by
 * a pack, and how many, up to what is in stock. A sold-out size can still be
 * picked: it says Out of stock, and the button becomes Preorder (the student
 * is notified when it is back), or it says it will not be restocked. The
 * server checks it all again and answers in words.
 */
export default function AddToCartSheet({
    product,
    open,
    onClose,
    onAdded,
}: {
    product: StorefrontProductDetails;
    open: boolean;
    onClose: () => void;
    onAdded: (message: string, wasPreorder: boolean) => void;
}) {
    const { request } = useAuth();
    const { replace: replaceCart } = useCart();

    const soldByPiece = product.variants.some(
        (variant) => variant.buy_price_centavos !== null,
    );
    // Every size can be picked; sold-out ones are crossed out and preordered.
    const anyVariant = (): boolean => true;
    const soldOut = (item: { stock_pieces: number }): boolean => item.stock_pieces === 0;
    const firstPack = (): number | null =>
        soldByPiece ? null : (product.buy_packs[0]?.id ?? null);

    const [picked, setPicked] = useState<Picked>(() => startingPicks(product.variants, anyVariant));
    const [packId, setPackId] = useState<number | null>(firstPack);
    const [quantityText, setQuantityText] = useState('1');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Start fresh every time it opens.
    useEffect(() => {
        if (open) {
            setPicked(startingPicks(product.variants, anyVariant));
            setPackId(firstPack());
            setQuantityText('1');
            setError(null);
        }
        // Only on opening; the choices are read from the product then.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const variant = pickedVariant(product.variants, product.options, picked);
    const pack = product.buy_packs.find((item) => item.id === packId);
    const piecesPerUnit = pack?.pieces ?? 1;
    const unitName = pack?.name ?? 'Piece';
    const unitPrice = pack ? pack.price_centavos : (variant?.buy_price_centavos ?? null);
    const pieceOnSale = pack === undefined && (variant?.sale_price_centavos ?? null) !== null;
    const priceIsSale = pieceOnSale || (pack !== undefined && product.status === 'on_sale');
    // The chosen size is sold out: preorder it (by the piece) instead.
    const preordering = variant !== undefined && soldOut(variant);
    // At most 99 of one item (Cart::MAX_QUANTITY on the server).
    const most = preordering
        ? 99
        : variant
          ? Math.min(99, Math.floor(variant.stock_pieces / piecesPerUnit))
          : 0;
    const quantity = Number(quantityText) || 0;
    const hasChoices = product.variants.length > 1;
    const unitChoices = (soldByPiece ? 1 : 0) + product.buy_packs.length;
    const canAdd = preordering
        ? !saving && variant.can_preorder && quantity >= 1 && quantity <= most
        : !saving && variant !== undefined && unitPrice !== null && quantity >= 1 && quantity <= most;

    const add = async (): Promise<void> => {
        if (!canAdd || variant === undefined) {
            return;
        }

        setSaving(true);
        setError(null);

        try {
            if (preordering) {
                const result = await request<{ message: string }>(`/products/${product.id}/preorder`, {
                    method: 'POST',
                    body: { product_variant_id: variant.id, quantity },
                });

                onAdded(result.message, true);

                return;
            }

            const result = await request<{ message: string; cart: CartView }>(`/products/${product.id}/cart`, {
                method: 'POST',
                body: {
                    product_variant_id: variant.id,
                    product_pack_id: pack?.id ?? null,
                    quantity,
                },
            });

            replaceCart(result.cart);
            onAdded(result.message, false);
        } catch (caught) {
            setError(
                caught instanceof ApiError
                    ? caught.message
                    : preordering
                      ? 'The preorder could not be placed. Try again.'
                      : 'It could not be added. Try again.',
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <BottomSheet
            open={open}
            onClose={onClose}
            title="Add to Cart"
            subtitle={product.name}
            icon={<ShoppingCart size={20} color="#1d4ed8" />}
            footer={
                preordering && !variant.can_preorder ? (
                    <View className="items-center rounded-2xl bg-slate-100 py-4">
                        <Text className="font-sans-bold text-base text-slate-500">
                            Will not be restocked
                        </Text>
                    </View>
                ) : (
                    <Pressable
                        onPress={add}
                        disabled={!canAdd}
                        accessibilityRole="button"
                        className={`flex-row items-center justify-center gap-2 rounded-2xl py-4 ${preordering ? 'bg-amber-400' : 'bg-brand'} ${canAdd ? '' : 'opacity-50'}`}
                    >
                        {saving ? (
                            <ActivityIndicator color={preordering ? '#451a03' : '#ffffff'} />
                        ) : preordering ? (
                            <CalendarClock size={18} color="#451a03" />
                        ) : (
                            <ShoppingCart size={18} color="#ffffff" />
                        )}
                        <Text
                            className={`font-sans-bold text-base ${preordering ? 'text-amber-950' : 'text-white'}`}
                        >
                            {preordering
                                ? 'Preorder'
                                : unitPrice !== null && quantity > 0 && variant
                                  ? `Add to Cart · ${formatPeso(unitPrice * quantity)}`
                                  : 'Add to Cart'}
                        </Text>
                    </Pressable>
                )
            }
        >
            <View className="flex-row gap-4">
                {product.photo_url && (
                    <Image
                        source={{ uri: product.photo_url }}
                        style={{ width: 80, height: 80, borderRadius: 12 }}
                        resizeMode="cover"
                    />
                )}
                <View className="flex-1 justify-center gap-1">
                    <View className="flex-row flex-wrap items-baseline gap-x-2">
                        {pieceOnSale && variant?.price_centavos != null && (
                            <Text className="font-sans text-sm text-slate-400 line-through">
                                {formatPeso(variant.price_centavos)}
                            </Text>
                        )}
                        <Text
                            className={`font-sans-bold text-2xl ${priceIsSale ? 'text-red-600' : 'text-blue-700'}`}
                        >
                            {unitPrice !== null ? formatPeso(unitPrice) : 'Choose below'}
                        </Text>
                        {unitPrice !== null && (
                            <Text className="font-sans text-xs text-slate-500">
                                / {pack ? `${pack.name} of ${pack.pieces}` : 'pc'}
                            </Text>
                        )}
                    </View>
                    {variant && (
                        <Text
                            className={`font-sans-bold text-xs ${preordering ? 'text-red-600' : 'text-slate-500'}`}
                        >
                            {preordering
                                ? 'Out of stock'
                                : variant.pieces_left !== null
                                  ? `Only ${formatUnits(variant.pieces_left, 'Piece')} left`
                                  : 'In stock'}
                        </Text>
                    )}
                </View>
            </View>

            {hasChoices &&
                product.options.map((option) => (
                    <OptionRow
                        key={option.name}
                        option={option}
                        picked={picked}
                        variants={product.variants}
                        canPick={anyVariant}
                        isOut={soldOut}
                        onPick={(choice) => {
                            setPicked(pickChoice(product.variants, product.options, picked, option.name, choice, anyVariant));
                            setQuantityText('1');
                        }}
                    />
                ))}

            {preordering && variant.not_restocked && (
                <View className="rounded-xl bg-slate-100 px-4 py-3">
                    <Text className="font-sans-bold text-sm leading-5 text-slate-600">
                        This {hasChoices ? 'size or color' : 'item'} is out of stock and will not
                        be restocked.
                    </Text>
                </View>
            )}

            {preordering && variant.can_preorder && (
                <View className="rounded-xl bg-amber-50 px-4 py-3">
                    <Text className="font-sans text-xs leading-5 text-amber-900">
                        This {hasChoices ? 'size or color' : 'item'} is out of stock. Preorder it
                        and you will be notified when it is back in stock. There is nothing to pay
                        now, and nothing is held for you.
                    </Text>
                </View>
            )}

            {!preordering && unitChoices > 1 && (
                <View className="gap-2">
                    <Text className="font-sans-bold text-sm text-slate-700">Buy by</Text>
                    <View className="flex-row flex-wrap gap-2">
                        {soldByPiece && (
                            <ChoiceChip
                                label="Piece"
                                chosen={packId === null}
                                disabled={
                                    variant !== undefined && variant.buy_price_centavos === null
                                }
                                price={variant?.buy_price_centavos ?? null}
                                onPress={() => {
                                    setPackId(null);
                                    setQuantityText('1');
                                }}
                            />
                        )}
                        {product.buy_packs.map((item) => (
                            <ChoiceChip
                                key={item.id}
                                label={`${item.name} of ${item.pieces}`}
                                chosen={item.id === packId}
                                disabled={
                                    variant !== undefined && variant.stock_pieces < item.pieces
                                }
                                price={item.price_centavos}
                                onPress={() => {
                                    setPackId(item.id);
                                    setQuantityText('1');
                                }}
                            />
                        ))}
                    </View>
                </View>
            )}

            {!(preordering && !variant.can_preorder) && (
            <View className="gap-2">
                <Text className="font-sans-bold text-sm text-slate-700">
                    {preordering ? 'How many to preorder?' : 'How many?'}
                </Text>
                <QuantityStepper
                    value={quantityText}
                    onChange={setQuantityText}
                    most={most}
                    unitText={
                        preordering
                            ? unitWord(quantity, 'Piece')
                            : `${unitWord(quantity, unitName)}${
                                  piecesPerUnit > 1
                                      ? ` (${formatUnits(quantity * piecesPerUnit, 'Piece')})`
                                      : ''
                              }`
                    }
                />
                {!preordering && variant && quantity > most && most > 0 && (
                    <Text className="font-sans-semibold text-sm text-red-600">
                        Only {formatUnits(most, unitName)} can be added.
                    </Text>
                )}
                {hasChoices && variant === undefined && (
                    <Text className="font-sans text-sm text-slate-500">
                        {chooseFirstText(product, picked)}
                    </Text>
                )}
            </View>
            )}

            {error && (
                <View className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <Text className="font-sans-semibold text-sm text-red-700">{error}</Text>
                </View>
            )}
        </BottomSheet>
    );
}

/**
 * "Choose a size first.", "Choose a capacity and color first." or, once the
 * capacity is chosen, "Choose a color first."
 */
export function chooseFirstText(product: StorefrontProductDetails, picked: Picked = {}): string {
    const names = product.options
        .filter((option) => !picked[option.name])
        .map((option) => option.name.toLowerCase());

    return names.length > 0 ? `Choose a ${names.join(' and ')} first.` : 'Choose one first.';
}
