import { CalendarClock } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';

import { chooseFirstText } from '@/components/AddToCartSheet';
import BottomSheet from '@/components/BottomSheet';
import ChoiceChip from '@/components/ChoiceChip';
import PriceLines from '@/components/PriceLines';
import QuantityStepper from '@/components/QuantityStepper';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, unitWord } from '@/lib/format';
import type { StorefrontProductDetails } from '@/lib/types';

/** As on the website: a reservation, so no stock limit, only this one. */
const MOST = 1000;

/**
 * Preorder, like the website's: which size or color and how many. Nothing
 * is paid; it tells the PROWARE office how many to order.
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
    const firstChoice = (): number | null =>
        product.variants.length === 1 ? product.variants[0].id : null;

    const [variantId, setVariantId] = useState<number | null>(firstChoice);
    const [quantityText, setQuantityText] = useState('1');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Start fresh every time it opens.
    useEffect(() => {
        if (open) {
            setVariantId(firstChoice());
            setQuantityText('1');
            setError(null);
        }
        // Only on opening; the choices are read from the product then.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const quantity = Number(quantityText) || 0;
    const hasChoices = product.variants.length > 1;
    const canPlace = !saving && variantId !== null && quantity >= 1 && quantity <= MOST;

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
                    body: { product_variant_id: variantId, quantity },
                },
            );

            onPlaced(result.message);
        } catch (caught) {
            setError(
                caught instanceof ApiError
                    ? caught.message
                    : 'The preorder could not be placed. Please try again.',
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
                    <Text className="font-sans-bold text-base text-amber-950">Preorder</Text>
                </Pressable>
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
                    {product.preorders_close_on && (
                        <Text className="font-sans-bold text-xs text-amber-700">
                            Preorders close {formatDate(product.preorders_close_on)}
                        </Text>
                    )}
                </View>
            </View>

            {hasChoices && (
                <View className="gap-2">
                    <Text className="font-sans-bold text-sm text-slate-700">
                        {product.options.map((option) => option.name).join(' · ') ||
                            'Choose one'}
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                        {product.variants.map((item) => (
                            <ChoiceChip
                                key={item.id}
                                label={item.label}
                                chosen={item.id === variantId}
                                tone="amber"
                                onPress={() => setVariantId(item.id)}
                            />
                        ))}
                    </View>
                </View>
            )}

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
                        {chooseFirstText(product)}
                    </Text>
                )}
            </View>

            <View className="rounded-xl bg-amber-50 px-4 py-3">
                <Text className="font-sans text-xs leading-5 text-amber-900">
                    A preorder reserves the item so the PROWARE office knows how
                    many to order. There is nothing to pay now. If you preorder
                    the same size again, the new number replaces the old one.
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
