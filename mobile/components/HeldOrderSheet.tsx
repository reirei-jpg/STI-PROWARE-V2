import { router } from 'expo-router';
import { ShoppingBag } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import BottomSheet from '@/components/BottomSheet';
import QuantityStepper from '@/components/QuantityStepper';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime, formatPeso, formatUnits, unitWord } from '@/lib/format';
import type { StudentPreorder } from '@/lib/types';

/**
 * Order Now on pieces held for the student (as on the website): how many
 * (all or fewer; the rest go to the next student), with the total,
 * early-bird pieces first. The order is placed at once and its screen opens.
 */
export default function HeldOrderSheet({
    preorder,
    open,
    onClose,
}: {
    preorder: StudentPreorder;
    open: boolean;
    onClose: () => void;
}) {
    const { request } = useAuth();
    const [quantityText, setQuantityText] = useState(String(preorder.quantity));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setQuantityText(String(preorder.quantity));
            setError(null);
        }
    }, [open, preorder.quantity]);

    const quantity = Number(quantityText) || 0;
    const piecePrice = preorder.piece_price_centavos ?? 0;
    const earlyBirdPrice = Math.min(preorder.early_bird_price_centavos ?? piecePrice, piecePrice);
    const earlyBirdPieces = earlyBirdPrice < piecePrice ? Math.min(preorder.early_bird_pieces, quantity) : 0;
    const total = earlyBirdPieces * earlyBirdPrice + (quantity - earlyBirdPieces) * piecePrice;
    const canOrder = !saving && quantity >= 1 && quantity <= preorder.quantity;

    const order = async (): Promise<void> => {
        if (!canOrder) {
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const result = await request<{ message: string; order: { id: number } }>(
                `/preorders/${preorder.id}/order`,
                { method: 'POST', body: { quantity } },
            );

            onClose();
            router.push(`/order/${result.order.id}`);
        } catch (caught) {
            setError(caught instanceof ApiError ? caught.message : 'The order could not be placed. Try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <BottomSheet
            open={open}
            onClose={onClose}
            title="Order now"
            subtitle={`${preorder.product_name}${preorder.variant_label ? ` (${preorder.variant_label})` : ''}`}
            icon={<ShoppingBag size={20} color="#047857" />}
            footer={
                <Pressable
                    onPress={order}
                    disabled={!canOrder}
                    accessibilityRole="button"
                    className={`flex-row items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 ${canOrder ? '' : 'opacity-50'}`}
                >
                    {saving ? <ActivityIndicator color="#ffffff" /> : <ShoppingBag size={18} color="#ffffff" />}
                    <Text className="font-sans-bold text-base text-white">Order now · {formatPeso(total)}</Text>
                </Pressable>
            }
        >
            <Text className="font-sans text-sm text-slate-600">
                Held for you until {formatDateTime(preorder.held_until)}. Order before then, or the pieces go to the
                next student.
            </Text>

            <View className="gap-2">
                <Text className="font-sans-bold text-sm text-slate-700">How many?</Text>
                <QuantityStepper
                    value={quantityText}
                    onChange={setQuantityText}
                    most={preorder.quantity}
                    showLeft={false}
                    unitText={`${unitWord(quantity, 'Piece')} of ${formatUnits(preorder.quantity, 'Piece')} held`}
                />
                {earlyBirdPieces > 0 && (
                    <Text className="font-sans-bold text-sm text-red-600">
                        {formatUnits(earlyBirdPieces, 'Piece')} at the early-bird price of {formatPeso(earlyBirdPrice)}
                    </Text>
                )}
                {quantity > 0 && quantity < preorder.quantity && (
                    <Text className="font-sans text-sm text-slate-500">
                        The other {preorder.quantity - quantity} will go to the next student.
                    </Text>
                )}
            </View>

            {error && (
                <View className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <Text className="font-sans-semibold text-sm text-red-700">{error}</Text>
                </View>
            )}
        </BottomSheet>
    );
}
