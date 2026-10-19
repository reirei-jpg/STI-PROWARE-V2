import { CalendarClock, Plus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';

import { chooseFirstText } from '@/components/AddToCartSheet';
import BottomSheet from '@/components/BottomSheet';
import OptionRow from '@/components/OptionRow';
import PriceLines from '@/components/PriceLines';
import QuantityStepper from '@/components/QuantityStepper';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatPeso, unitWord } from '@/lib/format';
import { pickChoice, pickedVariant, startingPicks, type Picked } from '@/lib/option-picker';
import type { StorefrontProductDetails } from '@/lib/types';

/** As on the website: a reservation, so no stock limit, only this one. */
/** At most 99 of one item (PlacePreorderRequest::MAX_QUANTITY on the server). */
const MOST = 99;

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
    const quantity = Number(quantityText) || 0;
    const hasChoices = product.variants.length > 1;
    const labelOf = (id: number): string =>
        product.variants.find((variant) => variant.id === id)?.label ?? '';
    // With nothing added yet, Preorder sends the size chosen now.
    const lines: PreorderLine[] =
        added.length > 0
            ? added
            : variantId !== null && quantity >= 1
              ? [{ variantId, quantity: String(quantity) }]
              : [];
    const totalPieces = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
    const chosenNotAdded =
        added.length > 0 && variantId !== null && !added.some((line) => line.variantId === variantId);
    const canAdd = variantId !== null && quantity >= 1;
    const canPlace =
        !saving &&
        lines.length > 0 &&
        lines.every((line) => {
            const pieces = Number(line.quantity) || 0;

            return pieces >= 1 && pieces <= MOST;
        });

    const addChosen = (): void => {
        if (variantId === null || quantity < 1) {
            return;
        }

        const existing = added.find((line) => line.variantId === variantId);

        setAdded(
            existing
                ? added.map((line) =>
                      line === existing
                          ? { ...line, quantity: String(Math.min(MOST, (Number(line.quantity) || 0) + quantity)) }
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
                            quantity: Number(line.quantity) || 0,
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
                    {restock && (
                        <Text className="font-sans-bold text-xs text-red-600">Out of stock</Text>
                    )}
                    {!restock && product.preorders_close_on && (
                        <Text className="font-sans-bold text-xs text-amber-700">
                            Preorders close {formatDate(product.preorders_close_on)}
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
                                ? `Early bird: ${formatPeso(product.early_bird.price_centavos)} each for the next ${product.early_bird.pieces_left} pcs preordered`
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
                    most={MOST}
                    unitText={unitWord(quantity, 'Piece')}
                />
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
                                    most={MOST}
                                    unitText={unitWord(Number(line.quantity) || 0, 'Piece')}
                                />
                            </View>
                        ))}
                    </View>
                </View>
            )}

            <View className="rounded-xl bg-amber-50 px-4 py-3">
                <Text className="font-sans text-xs leading-5 text-amber-900">
                    {restock
                        ? 'This item is out of stock. Preorder it and you will be notified when it is back in stock. There is nothing to pay now, and nothing is held for you. If you preorder the same size again, the new number replaces the old one.'
                        : 'A preorder reserves the item so the PROWARE office knows how many to order. There is nothing to pay now. If you preorder the same size again, the new number replaces the old one.'}
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
