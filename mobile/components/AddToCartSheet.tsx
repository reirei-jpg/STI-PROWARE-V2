import { CalendarClock, Plus, ShoppingCart } from 'lucide-react-native';
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

/** At most 99 of one item (Cart::MAX_QUANTITY on the server). */
const MOST = 99;

type ProductVariantRow = StorefrontProductDetails['variants'][number];
type BuyPack = StorefrontProductDetails['buy_packs'][number];

/** A line to add: which size, by the piece (packId null) or a pack, and how many. */
type CartLine = { variantId: number; packId: number | null; quantity: string };

/**
 * Add to Cart, like the website's picker: size or color, by the piece or by
 * a pack, and how many, up to what is in stock. Several sizes, colors or
 * packs can be added to a list first; one Add to Cart button puts them all
 * in. A sold-out size can still be picked: it says Out of stock and can be
 * preordered (the student is notified when it is back), or it says it will
 * not be restocked. The server checks it all again and answers in words.
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
    const [added, setAdded] = useState<CartLine[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // A preorder placed while the list still has lines (the sheet stays open).
    const [notice, setNotice] = useState<string | null>(null);

    const resetPick = (): void => {
        setPicked(startingPicks(product.variants, anyVariant));
        setPackId(firstPack());
        setQuantityText('1');
    };

    // Start fresh every time it opens.
    useEffect(() => {
        if (open) {
            resetPick();
            setAdded([]);
            setError(null);
            setNotice(null);
        }
        // Only on opening; the choices are read from the product then.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const variantOf = (id: number): ProductVariantRow | undefined =>
        product.variants.find((item) => item.id === id);
    const packOf = (id: number | null): BuyPack | undefined =>
        product.buy_packs.find((item) => item.id === id);
    const priceOf = (item: ProductVariantRow | undefined, itemPack: BuyPack | undefined): number | null =>
        itemPack ? itemPack.price_centavos : (item?.buy_price_centavos ?? null);
    const piecesOf = (line: CartLine): number =>
        (Number(line.quantity) || 0) * (packOf(line.packId)?.pieces ?? 1);
    // "S", "S · Box of 12", "Piece", "Pack of 10".
    const labelOf = (line: CartLine): string => {
        const linePack = packOf(line.packId);
        const size = product.variants.length > 1 ? (variantOf(line.variantId)?.label ?? '') : '';
        const unitText = linePack
            ? `${linePack.name} of ${linePack.pieces}`
            : product.buy_packs.length > 0
              ? 'Piece'
              : '';

        return [size, unitText].filter((part) => part !== '').join(' · ') || 'Piece';
    };
    // The most of this size and unit that still fits in its stock, after the
    // other lines of the same size.
    const mostFor = (item: ProductVariantRow | undefined, itemPack: BuyPack | undefined, except?: CartLine): number => {
        if (item === undefined) {
            return 0;
        }

        const listed = added
            .filter((line) => line !== except && line.variantId === item.id)
            .reduce((sum, line) => sum + piecesOf(line), 0);

        return Math.min(MOST, Math.floor(Math.max(0, item.stock_pieces - listed) / (itemPack?.pieces ?? 1)));
    };

    const variant = pickedVariant(product.variants, product.options, picked);
    const pack = packOf(packId);
    const piecesPerUnit = pack?.pieces ?? 1;
    const unitName = pack?.name ?? 'Piece';
    const unitPrice = priceOf(variant, pack);
    const pieceOnSale = pack === undefined && (variant?.sale_price_centavos ?? null) !== null;
    const priceIsSale = pieceOnSale || (pack !== undefined && product.status === 'on_sale');
    // The chosen size is sold out: preorder it (by the piece) instead.
    const preordering = variant !== undefined && soldOut(variant);
    const existing = added.find(
        (line) => variant !== undefined && line.variantId === variant.id && line.packId === packId,
    );
    const most = preordering
        ? MOST
        : Math.min(mostFor(variant, pack), MOST - (Number(existing?.quantity) || 0));
    const quantity = Number(quantityText) || 0;
    const hasChoices = product.variants.length > 1;
    const unitChoices = (soldByPiece ? 1 : 0) + product.buy_packs.length;
    // A list only helps when there is more than one size or unit to pick.
    const canList = hasChoices || unitChoices > 1;
    const canAddChosen =
        variant !== undefined && !preordering && unitPrice !== null && quantity >= 1 && quantity <= most;
    // With nothing added yet, Add to Cart sends the size chosen now.
    const lines: CartLine[] =
        added.length > 0
            ? added
            : canAddChosen && variant !== undefined
              ? [{ variantId: variant.id, packId, quantity: String(quantity) }]
              : [];
    const total = lines.reduce(
        (sum, line) => sum + (priceOf(variantOf(line.variantId), packOf(line.packId)) ?? 0) * (Number(line.quantity) || 0),
        0,
    );
    const chosenNotAdded = added.length > 0 && canAddChosen && existing === undefined;
    const canSend =
        !saving && lines.length > 0 && lines.every((line) => (Number(line.quantity) || 0) >= 1);
    const canPreorder = preordering && !saving && variant.can_preorder && quantity >= 1 && quantity <= MOST;

    const addChosen = (): void => {
        if (!canAddChosen || variant === undefined) {
            return;
        }

        setAdded(
            existing
                ? added.map((line) =>
                      line === existing
                          ? { ...line, quantity: String((Number(line.quantity) || 0) + quantity) }
                          : line,
                  )
                : [...added, { variantId: variant.id, packId, quantity: String(quantity) }],
        );
        setError(null);
        setNotice(null);
        resetPick();
    };

    const addToCart = async (): Promise<void> => {
        if (!canSend) {
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const result = await request<{ message: string; cart: CartView }>(`/products/${product.id}/cart`, {
                method: 'POST',
                body: {
                    items: lines.map((line) => ({
                        product_variant_id: line.variantId,
                        product_pack_id: line.packId,
                        quantity: Number(line.quantity) || 0,
                    })),
                },
            });

            replaceCart(result.cart);
            onAdded(result.message, false);
        } catch (caught) {
            setError(caught instanceof ApiError ? caught.message : 'It could not be added. Try again.');
        } finally {
            setSaving(false);
        }
    };

    const preorder = async (): Promise<void> => {
        if (!canPreorder || variant === undefined) {
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const result = await request<{ message: string }>(`/products/${product.id}/preorder`, {
                method: 'POST',
                body: { product_variant_id: variant.id, quantity },
            });

            // Keep the sheet open when there are lines still to add.
            if (added.length > 0) {
                setNotice(result.message);
                resetPick();
            } else {
                onAdded(result.message, true);
            }
        } catch (caught) {
            setError(caught instanceof ApiError ? caught.message : 'The preorder could not be placed. Try again.');
        } finally {
            setSaving(false);
        }
    };

    const cartButton = (
        <Pressable
            onPress={addToCart}
            disabled={!canSend}
            accessibilityRole="button"
            className={`flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-brand py-4 ${canSend ? '' : 'opacity-50'}`}
        >
            {saving && !preordering ? (
                <ActivityIndicator color="#ffffff" />
            ) : (
                <ShoppingCart size={18} color="#ffffff" />
            )}
            <Text className="font-sans-bold text-base text-white">
                {`${added.length > 1 ? 'Add all to Cart' : 'Add to Cart'}${
                    // Next to the Preorder button there is no room for the total.
                    lines.length > 0 && !preordering ? ` · ${formatPeso(total)}` : ''
                }`}
            </Text>
        </Pressable>
    );

    return (
        <BottomSheet
            open={open}
            onClose={onClose}
            title="Add to Cart"
            subtitle={product.name}
            icon={<ShoppingCart size={20} color="#1d4ed8" />}
            footer={
                <View className="gap-2">
                    {chosenNotAdded && variant !== undefined && (
                        <Text className="font-sans-semibold text-sm text-blue-800">
                            {labelOf({ variantId: variant.id, packId, quantity: quantityText })} is not in your list
                            yet. Tap Add to list to include it.
                        </Text>
                    )}
                    {preordering && !variant.can_preorder && added.length === 0 ? (
                        <View className="items-center rounded-2xl bg-slate-100 py-4">
                            <Text className="font-sans-bold text-base text-slate-500">
                                Will not be restocked
                            </Text>
                        </View>
                    ) : (
                        <View className="flex-row gap-2">
                            {preordering && variant.can_preorder && (
                                <Pressable
                                    onPress={preorder}
                                    disabled={!canPreorder}
                                    accessibilityRole="button"
                                    className={`flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-amber-400 py-4 ${canPreorder ? '' : 'opacity-50'}`}
                                >
                                    {saving ? (
                                        <ActivityIndicator color="#451a03" />
                                    ) : (
                                        <CalendarClock size={18} color="#451a03" />
                                    )}
                                    <Text className="font-sans-bold text-base text-amber-950">
                                        {added.length > 0 && hasChoices ? `Preorder ${variant.label}` : 'Preorder'}
                                    </Text>
                                </Pressable>
                            )}
                            {(!preordering || added.length > 0) && cartButton}
                        </View>
                    )}
                </View>
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

            {notice && (
                <View className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <Text className="font-sans-semibold text-sm text-emerald-800">{notice}</Text>
                </View>
            )}

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
                        most={variant ? most : MOST}
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
                    {!preordering && variant && most === 0 && (
                        <Text className="font-sans-semibold text-sm text-amber-700">
                            {added.length > 0
                                ? 'Your list already has all that is left of this size.'
                                : `Not enough left for 1 ${unitName}.`}
                        </Text>
                    )}
                    {hasChoices && variant === undefined && (
                        <Text className="font-sans text-sm text-slate-500">
                            {chooseFirstText(product, picked)}
                        </Text>
                    )}
                    {canList && !preordering && (
                        <Pressable
                            onPress={addChosen}
                            disabled={!canAddChosen}
                            accessibilityRole="button"
                            className={`flex-row items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 py-3 ${canAddChosen ? '' : 'opacity-50'}`}
                        >
                            <Plus size={16} color="#1e40af" />
                            <Text className="font-sans-bold text-sm text-blue-800">Add to list</Text>
                        </Pressable>
                    )}
                    {canList && !preordering && added.length === 0 && (
                        <Text className="font-sans text-xs text-slate-500">
                            To buy more than one size, color or pack, choose one, tap Add to list, then
                            choose the next.
                        </Text>
                    )}
                </View>
            )}

            {added.length > 0 && (
                <View className="gap-2">
                    <Text className="font-sans-bold text-sm text-slate-700">Your list</Text>
                    <View className="rounded-xl border border-slate-200 bg-white">
                        {added.map((line, index) => {
                            const lineVariant = variantOf(line.variantId);
                            const linePack = packOf(line.packId);
                            const linePrice = priceOf(lineVariant, linePack);
                            const onSale = linePack === undefined && (lineVariant?.sale_price_centavos ?? null) !== null;

                            return (
                                <View
                                    key={`${line.variantId}-${line.packId ?? 'piece'}`}
                                    className={`gap-2 px-3 py-3 ${index > 0 ? 'border-t border-slate-100' : ''}`}
                                >
                                    <View className="flex-row items-center justify-between gap-3">
                                        <View className="flex-1">
                                            <Text className="font-sans-bold text-sm text-slate-800" numberOfLines={1}>
                                                {labelOf(line)}
                                            </Text>
                                            <Text className="font-sans text-xs text-slate-500">
                                                {onSale && lineVariant?.price_centavos != null && (
                                                    <Text className="line-through">
                                                        {formatPeso(lineVariant.price_centavos)}{' '}
                                                    </Text>
                                                )}
                                                <Text className={onSale ? 'font-sans-bold text-red-600' : ''}>
                                                    {formatPeso(linePrice ?? 0)}
                                                </Text>{' '}
                                                each
                                            </Text>
                                        </View>
                                        <Pressable
                                            onPress={() => setAdded(added.filter((other) => other !== line))}
                                            accessibilityRole="button"
                                            accessibilityLabel={`Remove ${labelOf(line)}`}
                                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5"
                                        >
                                            <Text className="font-sans-bold text-sm text-red-700">Remove</Text>
                                        </Pressable>
                                    </View>
                                    <QuantityStepper
                                        value={line.quantity}
                                        onChange={(value) =>
                                            setAdded(added.map((other) => (other === line ? { ...other, quantity: value } : other)))
                                        }
                                        most={mostFor(lineVariant, linePack, line)}
                                        unitText={unitWord(Number(line.quantity) || 0, linePack?.name ?? 'Piece')}
                                    />
                                </View>
                            );
                        })}
                    </View>
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
