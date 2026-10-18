import { Shirt } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import BottomSheet from '@/components/BottomSheet';
import ChoiceChip from '@/components/ChoiceChip';
import QuantityStepper from '@/components/QuantityStepper';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { formatPeso } from '@/lib/format';
import type { CartView, StorefrontSetPiece, StorefrontUniformSet } from '@/lib/types';

/**
 * Buy the Set, like the website's picker: for boys or girls, the top's
 * size, the bottom (for girls: ladies' pants or skirt) and its size, and
 * how many sets. Sold-out sizes are crossed out; they are preordered on
 * the item itself. The server checks it all again and answers in words.
 */
export default function UniformSetSheet({
    set,
    onClose,
    onAdded,
}: {
    set: StorefrontUniformSet | null;
    onClose: () => void;
    onAdded: (message: string) => void;
}) {
    const { request } = useAuth();
    const { replace: replaceCart } = useCart();
    const [forWho, setForWho] = useState<string | null>(null);
    const [topId, setTopId] = useState<number | null>(null);
    const [bottomProductId, setBottomProductId] = useState<number | null>(null);
    const [bottomId, setBottomId] = useState<number | null>(null);
    const [quantityText, setQuantityText] = useState('1');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Start fresh every time a set is opened.
    useEffect(() => {
        if (set) {
            setForWho(set.options.length === 1 ? set.options[0].for : null);
            setTopId(null);
            setBottomProductId(null);
            setBottomId(null);
            setQuantityText('1');
            setError(null);
        }
    }, [set]);

    const option = set?.options.find((item) => item.for === forWho);
    const bottom =
        option?.bottoms.length === 1
            ? option.bottoms[0]
            : option?.bottoms.find((item) => item.product_id === bottomProductId);
    const topSize = option?.top.sizes.find((size) => size.variant_id === topId);
    const bottomSize = bottom?.sizes.find((size) => size.variant_id === bottomId);
    const most = Math.min(99, topSize?.stock_pieces ?? 99, bottomSize?.stock_pieces ?? 99);
    const quantity = Number(quantityText) || 0;
    const separately =
        topSize?.price_centavos != null && bottomSize?.price_centavos != null
            ? topSize.price_centavos + bottomSize.price_centavos
            : null;
    const setPrice =
        set === null ? 0 : separately === null ? set.price_centavos : Math.min(set.price_centavos, separately);
    const missing = [
        !option && 'who it is for',
        option && !topSize && `the ${option.top.kind.toLowerCase()} size`,
        option && !bottom && 'the bottom',
        bottom && !bottomSize && `the ${bottom.kind.toLowerCase()} size`,
    ].filter(Boolean);
    const canAdd = !saving && missing.length === 0 && quantity >= 1 && quantity <= most;

    const add = async (): Promise<void> => {
        if (!canAdd || set === null || topSize === undefined || bottomSize === undefined) {
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const result = await request<{ message: string; cart: CartView }>(`/uniform-sets/${set.id}/cart`, {
                method: 'POST',
                body: {
                    for: forWho,
                    top_variant_id: topSize.variant_id,
                    bottom_variant_id: bottomSize.variant_id,
                    quantity,
                },
            });

            replaceCart(result.cart);
            onAdded(result.message);
        } catch (caught) {
            setError(caught instanceof ApiError ? caught.message : 'The set could not be added. Try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <BottomSheet
            open={set !== null}
            onClose={onClose}
            title="Buy the Set"
            subtitle={set?.name ?? ''}
            icon={<Shirt size={20} color="#1d4ed8" />}
            footer={
                <Pressable
                    onPress={add}
                    disabled={!canAdd}
                    accessibilityRole="button"
                    className={`flex-row items-center justify-center gap-2 rounded-2xl bg-brand py-4 ${canAdd ? '' : 'opacity-50'}`}
                >
                    {saving ? <ActivityIndicator color="#ffffff" /> : <Shirt size={18} color="#ffffff" />}
                    <Text className="font-sans-bold text-base text-white">
                        {missing.length === 0 && quantity > 0
                            ? `Add Set to Cart · ${formatPeso(setPrice * quantity)}`
                            : 'Add Set to Cart'}
                    </Text>
                </Pressable>
            }
        >
            {set && set.options.length > 1 && (
                <ChipRow label="Who is it for?">
                    {set.options.map((item) => (
                        <ChoiceChip
                            key={item.for}
                            label={item.label}
                            chosen={forWho === item.for}
                            onPress={() => {
                                setForWho(item.for);
                                setTopId(null);
                                setBottomProductId(null);
                                setBottomId(null);
                                setQuantityText('1');
                            }}
                        />
                    ))}
                </ChipRow>
            )}

            {option && (
                <SizeRow
                    piece={option.top}
                    chosen={topId}
                    onPick={(id) => {
                        setTopId(id);
                        setQuantityText('1');
                    }}
                />
            )}

            {option && option.bottoms.length > 1 && (
                <ChipRow label="Bottom">
                    {option.bottoms.map((item) => (
                        <ChoiceChip
                            key={item.product_id}
                            label={item.kind}
                            chosen={bottom?.product_id === item.product_id}
                            onPress={() => {
                                setBottomProductId(item.product_id);
                                setBottomId(null);
                            }}
                        />
                    ))}
                </ChipRow>
            )}

            {bottom && (
                <SizeRow
                    piece={bottom}
                    chosen={bottomId}
                    onPick={(id) => {
                        setBottomId(id);
                        setQuantityText('1');
                    }}
                />
            )}

            {option && (
                <View className="rounded-xl bg-slate-50 px-4 py-3">
                    <Text className="font-sans text-xs leading-5 text-slate-600">
                        A crossed-out size is out of stock. You can preorder it on the item itself,
                        and you will be notified when it is back in stock.
                    </Text>
                </View>
            )}

            <View className="gap-2">
                <Text className="font-sans-bold text-sm text-slate-700">How many sets?</Text>
                <QuantityStepper
                    value={quantityText}
                    onChange={setQuantityText}
                    most={Math.max(most, 1)}
                    unitText={quantity === 1 ? 'set' : 'sets'}
                />
                {missing.length > 0 && (
                    <Text className="font-sans text-sm text-slate-500">Choose {missing.join(' and ')} first.</Text>
                )}
            </View>

            {set && separately !== null && separately > setPrice && (
                <Text className="font-sans-semibold text-xs text-emerald-700">
                    You save {formatPeso((separately - setPrice) * Math.max(quantity, 1))} compared with
                    buying them one by one ({formatPeso(separately)} a set).
                </Text>
            )}

            {error && (
                <View className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <Text className="font-sans-semibold text-sm text-red-700">{error}</Text>
                </View>
            )}
        </BottomSheet>
    );
}

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <View className="gap-2">
            <Text className="font-sans-bold text-sm text-slate-700">{label}</Text>
            <View className="flex-row flex-wrap gap-2">{children}</View>
        </View>
    );
}

/** "Polo size": the piece's sizes; sold-out ones are crossed out. */
function SizeRow({
    piece,
    chosen,
    onPick,
}: {
    piece: StorefrontSetPiece;
    chosen: number | null;
    onPick: (variantId: number) => void;
}) {
    return (
        <ChipRow label={`${piece.kind} size`}>
            {piece.sizes.map((size) => (
                <ChoiceChip
                    key={size.variant_id}
                    label={size.label}
                    chosen={chosen === size.variant_id}
                    disabled={size.stock_pieces === 0}
                    onPress={() => onPick(size.variant_id)}
                />
            ))}
        </ChipRow>
    );
}
