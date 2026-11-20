import { CalendarClock, Plus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';

import { chooseFirstText } from '@/components/AddToCartSheet';
import BottomSheet from '@/components/BottomSheet';
import OptionRow from '@/components/OptionRow';
import PriceLines from '@/components/PriceLines';
import QuantityStepper from '@/components/QuantityStepper';
import { typedQuantity } from '@/lib/quantity';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatPeso, unitWord } from '@/lib/format';
import { mostPerItem } from '@/lib/buyer-limit';
import { PREORDER_PRICE_MAY_CHANGE } from '@/lib/preorder-price';
import { pickChoice, pickedVariant, startingPicks, type Picked } from '@/lib/option-picker';
import type { StorefrontProductDetails } from '@/lib/types';

/** As on the website: a reservation, so no stock limit, only this one. */

type PreorderLine = { variantId: number; quantity: string };

/** "2 pcs", "1 pc". */
function piecesText(pieces: number): string {
    return `${pieces} ${pieces === 1 ? 'pc' : 'pcs'}`;
}

/**
 * Preorder, like the website's: which sizes or colors and how many of each.
 * Sizes are added one at a time, like a cart, and one Preorder button sends
 * them all. Nothing is paid; it tells the PROWARE office how many to order.
 * For an item for sale that is out of stock, only its sizes that can be
 * preordered are offered, and the student is notified when it is back in
 * stock.
 */
export default function PreorderSheet({
    product,
    open,
    onClose,
    onPlaced,
}: {
    product: StorefrontProductDetails;
    open: boolean;
    onClose: () => void;
    onPlaced: (message: string) => void;
}) {
    // The most of one size this buyer can preorder in all (BuyerLimit on the server).
    const most = mostPerItem(product.most_per_item);
    const { request } = useAuth();
    // An item for sale that is out of stock: only its sizes that can be
    // preordered. A Coming Soon product: any size, nothing is in stock yet.
    const restock = product.status !== 'preorder';
    const anyVariant = (variant: { can_preorder: boolean }): boolean =>
        !restock || variant.can_preorder;

    const [picked, setPicked] = useState<Picked>(() => startingPicks(product.variants, anyVariant));
    const [quantityText, setQuantityText] = useState('1');
    const [added, setAdded] = useState<PreorderLine[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Start fresh every time it opens.
    useEffect(() => {
        if (open) {
            setPicked(startingPicks(product.variants, anyVariant));
            setQuantityText('1');
            setAdded([]);
            setError(null);
        }
        // Only on opening; the choices are read from the product then.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const chosen = pickedVariant(product.variants, product.options, picked);
    const variantId = chosen !== undefined && anyVariant(chosen) ? chosen.id : null;
    const quantity = typedQuantity(quantityText) ?? 0;
    // The product's Most per buyer: pieces this buyer can still get, all sizes
    // together, less what this preorder already lists (null: no limit).
    const perBuyerLeft = product.per_buyer_left ?? null;
    const productMost = (except?: PreorderLine): number =>
        perBuyerLeft === null
            ? most
            : Math.min(
                  most,
                  Math.max(
                      0,
                      perBuyerLeft -
                          added.filter((line) => line !== except).reduce((sum, line) => sum + (typedQuantity(line.quantity) ?? 0), 0),
                  ),
              );
    // Adding to a size already listed adds to it, so all listed pieces count.
    const chosenMost = productMost();
    const stoppedByProduct = perBuyerLeft !== null && chosenMost < most;
    const perBuyerText =
        product.most_per_buyer == null ? '' : `Each buyer can get at most ${piecesText(product.most_per_buyer)} of this item`;
    const hasChoices = product.variants.length > 1;
    const labelOf = (id: number): string =>
        product.variants.find((variant) => variant.id === id)?.label ?? '';
    // With nothing added yet, Preorder sends the size chosen now.
    const lines: PreorderLine[] =
        added.length > 0
            ? added
            : variantId !== null && quantity >= 1 && quantity <= chosenMost
              ? [{ variantId, quantity: String(quantity) }]
              : [];
    const totalPieces = lines.reduce((sum, line) => sum + (typedQuantity(line.quantity) ?? 0), 0);
    const chosenNotAdded =
        added.length > 0 && variantId !== null && !added.some((line) => line.variantId === variantId);
    const canAdd = variantId !== null && quantity >= 1 && quantity <= chosenMost;
    const canPlace =
        !saving &&
        lines.length > 0 &&
        lines.every((line) => {
            const pieces = typedQuantity(line.quantity) ?? 0;

            return pieces >= 1 && pieces <= (added.includes(line) ? productMost(line) : chosenMost);
        });

    const addChosen = (): void => {
        if (variantId === null || quantity < 1 || quantity > chosenMost) {
            return;
        }

        const existing = added.find((line) => line.variantId === variantId);

        setAdded(
            existing
                ? added.map((line) =>
                      line === existing
                          ? { ...line, quantity: String(Math.min(most, (typedQuantity(line.quantity) ?? 0) + quantity)) }
                          : line,
                  )
                : [...added, { variantId, quantity: String(quantity) }],
        );
        setError(null);
        setPicked(startingPicks(product.variants, anyVariant));
        setQuantityText('1');
    };

    const changeLine = (id: number, value: string): void =>
        setAdded(added.map((line) => (line.variantId === id ? { ...line, quantity: value } : line)));

    const place = async (): Promise<void> => {
        if (!canPlace) {
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const result = await request<{ message: string }>(
                `/products/${product.id}/preorder`,
                {
                    method: 'POST',
                    body: {
                        items: lines.map((line) => ({
                            product_variant_id: line.variantId,
                            quantity: typedQuantity(line.quantity) ?? 0,
                        })),
                    },
                },
            );

            onPlaced(result.message);
        } catch (caught) {
            setError(
                caught instanceof ApiError
                    ? caught.message
                    : 'The preorder could not be placed. Try again.',
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <BottomSheet
            open={open}
            onClose={onClose}
            title="Preorder"
            subtitle={product.name}
            icon={<CalendarClock size={20} color="#b45309" />}
            footer={
                <View className="gap-2">
                    {chosenNotAdded && variantId !== null && (
                        <Text className="font-sans-semibold text-sm text-amber-800">
                            {labelOf(variantId)} is not in your preorder yet. Tap Add to preorder to include it.
                        </Text>
                    )}
                    <Pressable
                        onPress={place}
                        disabled={!canPlace}
                        accessibilityRole="button"
                        className={`flex-row items-center justify-center gap-2 rounded-2xl bg-amber-400 py-4 ${canPlace ? '' : 'opacity-50'}`}
                    >
                        {saving ? (
                            <ActivityIndicator color="#451a03" />
                        ) : (
                            <CalendarClock size={18} color="#451a03" />
                        )}
                        <Text className="font-sans-bold text-base text-amber-950">
                            {added.length > 1 ? `Preorder ${piecesText(totalPieces)}` : 'Preorder'}
                        </Text>
                    </Pressable>
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
                    <PriceLines price={product.price} />
                    <Text className="font-sans text-xs text-slate-600">{PREORDER_PRICE_MAY_CHANGE}</Text>
                    {restock &&
                        (product.available_soon ? (
                            <Text className="font-sans-bold text-xs text-blue-700">Available soon</Text>
                        ) : (
                            <Text className="font-sans-bold text-xs text-red-600">Out of stock</Text>
                        ))}
                    {!restock && product.preorders_close_on && (
                        <Text className="font-sans-bold text-xs text-amber-700">
                            Preorders close {formatDate(product.preorders_close_on)}
                        </Text>
                    )}
                    {product.most_per_buyer != null && (
                        <Text className="font-sans-bold text-xs text-slate-600">
                            Limit: {piecesText(product.most_per_buyer)} per buyer
                            {perBuyerLeft !== null && perBuyerLeft < product.most_per_buyer
                                ? perBuyerLeft === 0
                                    ? ' · you have reached it'
                                    : ` · you can get ${piecesText(perBuyerLeft)} more`
                                : ''}
                        </Text>
                    )}
                    {!restock && product.expected_arrival && (
                        <Text className="font-sans-semibold text-xs text-slate-600">
                            Expected to arrive {product.expected_arrival}
                        </Text>
                    )}
                    {!restock && product.early_bird && (
                        <Text className="font-sans-bold text-xs text-red-600">
                            {product.early_bird.pieces_left > 0
                                ? `Early bird: ${formatPeso(product.early_bird.price_centavos)} each, kept for the next ${product.early_bird.pieces_left} pcs preordered`
                                : 'The early-bird pieces are all taken.'}
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
                        tone="amber"
                        onPick={(choice) =>
                            setPicked(pickChoice(product.variants, product.options, picked, option.name, choice, anyVariant))
                        }
                    />
                ))}

            <View className="gap-2">
                <Text className="font-sans-bold text-sm text-slate-700">How many?</Text>
                <QuantityStepper
                    value={quantityText}
                    onChange={setQuantityText}
                    most={Math.max(1, chosenMost)}
                    showLeft={false}
                    unitText={unitWord(quantity, 'Piece')}
                />
                {stoppedByProduct && (
                    <Text
                        className={`font-sans-semibold text-sm ${chosenMost === 0 ? 'text-red-600' : 'text-amber-700'}`}
                    >
                        {chosenMost === 0
                            ? `${perBuyerText}. You have reached it with ${added.length > 0 ? 'this preorder, your cart, orders or preorders' : 'your cart, orders or preorders'}.`
                            : `${perBuyerText}. You can preorder ${piecesText(chosenMost)} more.`}
                    </Text>
                )}
                {hasChoices && variantId === null && (
                    <Text className="font-sans text-sm text-slate-500">
                        {chooseFirstText(product, picked)}
                    </Text>
                )}
                {hasChoices && (
                    <Pressable
                        onPress={addChosen}
                        disabled={!canAdd}
                        accessibilityRole="button"
                        className={`flex-row items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 py-3 ${canAdd ? '' : 'opacity-50'}`}
                    >
                        <Plus size={16} color="#78350f" />
                        <Text className="font-sans-bold text-sm text-amber-900">Add to preorder</Text>
                    </Pressable>
                )}
                {hasChoices && added.length === 0 && (
                    <Text className="font-sans text-xs text-slate-500">
                        To preorder more than one size or color, choose one, tap Add to preorder, then choose the next.
                    </Text>
                )}
            </View>

            {added.length > 0 && (
                <View className="gap-2">
                    <Text className="font-sans-bold text-sm text-slate-700">
                        Your preorder ({piecesText(totalPieces)})
                    </Text>
                    <View className="rounded-xl border border-slate-200 bg-white">
                        {added.map((line, index) => (
                            <View
                                key={line.variantId}
                                className={`gap-2 px-3 py-3 ${index > 0 ? 'border-t border-slate-100' : ''}`}
                            >
                                <View className="flex-row items-center justify-between gap-3">
                                    <Text className="flex-1 font-sans-bold text-sm text-slate-800" numberOfLines={1}>
                                        {labelOf(line.variantId)}
                                    </Text>
                                    <Pressable
                                        onPress={() => setAdded(added.filter((other) => other !== line))}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Remove ${labelOf(line.variantId)}`}
                                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5"
                                    >
                                        <Text className="font-sans-bold text-sm text-red-700">Remove</Text>
                                    </Pressable>
                                </View>
                                <QuantityStepper
                                    value={line.quantity}
                                    onChange={(value) => changeLine(line.variantId, value)}
                                    most={Math.max(1, productMost(line))}
                    showLeft={false}
                                    unitText={unitWord(typedQuantity(line.quantity) ?? 0, 'Piece')}
                                />
                            </View>
                        ))}
                    </View>
                </View>
            )}

            <View className="rounded-xl bg-amber-50 px-4 py-3">
                <Text className="font-sans text-xs leading-5 text-amber-900">
                    {restock
                        ? 'This item is out of stock. Preorder it: you are notified when it is back in stock. If you preorder the same size again, the added pieces wait behind those already in line.'
                        : 'A preorder reserves the item so the PROWARE office knows how many to order. If you preorder the same size again, the added pieces wait behind those already in line.'}
                </Text>
            </View>

            {error && (
                <View className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <Text className="font-sans-semibold text-sm text-red-700">{error}</Text>
                </View>
            )}
        </BottomSheet>
    );
}
