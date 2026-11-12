import { Pencil } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import { chooseFirstText } from '@/components/AddToCartSheet';
import BottomSheet from '@/components/BottomSheet';
import OptionRow from '@/components/OptionRow';
import QuantityStepper from '@/components/QuantityStepper';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { mostPerItem } from '@/lib/buyer-limit';
import { formatUnits, unitWord } from '@/lib/format';
import { pickChoice, pickedVariant, type Picked } from '@/lib/option-picker';
import type { StorefrontProductDetails, StudentPreorder } from '@/lib/types';

/**
 * Edit a waiting preorder, like the website's: another size or color of the
 * same item (one that can be preordered) and how many. Lowering the quantity
 * keeps its place in line; raising it or changing the size or color moves it
 * to the end of the line, so the buyer is asked first.
 */
export default function EditPreorderSheet({
    preorder,
    onClose,
    onSaved,
}: {
    preorder: StudentPreorder | null;
    onClose: () => void;
    onSaved: (message: string, preorder: StudentPreorder) => void;
}) {
    const { request } = useAuth();
    const [product, setProduct] = useState<StorefrontProductDetails | null>(null);
    const [loadFailed, setLoadFailed] = useState(false);
    const [picked, setPicked] = useState<Picked>({});
    const [quantityText, setQuantityText] = useState('1');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load the item's sizes each time a preorder is opened, starting from its own.
    useEffect(() => {
        if (preorder === null) {
            return;
        }

        let stale = false;

        setProduct(null);
        setLoadFailed(false);
        setError(null);
        setQuantityText(String(preorder.quantity));

        request<StorefrontProductDetails>(`/products/${preorder.product_id}`)
            .then((details) => {
                if (stale) {
                    return;
                }

                setProduct(details);
                setPicked({ ...(details.variants.find((variant) => variant.id === preorder.product_variant_id)?.choices ?? {}) });
            })
            .catch(() => !stale && setLoadFailed(true));

        return () => {
            stale = true;
        };
        // Only when another preorder is opened; `request` is stable enough.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [preorder?.id]);

    const restock = product !== null && product.status !== 'preorder';
    // Its own size can always stay; another one only when it can be preordered.
    const canPick = (variant: { id: number; can_preorder: boolean }): boolean =>
        !restock || variant.can_preorder || variant.id === preorder?.product_variant_id;
    const chosen = product ? pickedVariant(product.variants, product.options, picked) : undefined;
    const variantId = chosen !== undefined && canPick(chosen) ? chosen.id : null;
    const quantity = Number(quantityText) || 0;
    const most = mostPerItem(product?.most_per_item);
    const changed =
        preorder !== null && variantId !== null && (variantId !== preorder.product_variant_id || quantity !== preorder.quantity);
    const movesToEnd =
        preorder !== null && variantId !== null && (variantId !== preorder.product_variant_id || quantity > preorder.quantity);
    const canSave = !saving && changed && quantity >= 1 && quantity <= most;

    const send = async (): Promise<void> => {
        if (preorder === null || variantId === null) {
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const result = await request<{ message: string; preorder: StudentPreorder }>(`/preorders/${preorder.id}`, {
                method: 'PATCH',
                body: { product_variant_id: variantId, quantity },
            });

            onSaved(result.message, result.preorder);
        } catch (caught) {
            setError(caught instanceof ApiError ? caught.message : 'The preorder could not be changed. Try again.');
        } finally {
            setSaving(false);
        }
    };

    const save = (): void => {
        if (!canSave || preorder === null || chosen === undefined) {
            return;
        }

        if (!movesToEnd) {
            void send();

            return;
        }

        // Losing its place cannot be undone, so the buyer answers first.
        Alert.alert(
            'Move to the end of the line?',
            `${formatUnits(quantity, 'Piece')} of ${chosen.label || preorder.product_name}: your preorder moves to the end of the line, behind everyone already waiting. Early-bird pieces you already have stay with it. This cannot be undone.`,
            [
                { text: 'Keep as it is', style: 'cancel' },
                { text: 'Change', onPress: () => void send() },
            ],
        );
    };

    return (
        <BottomSheet
            open={preorder !== null}
            onClose={onClose}
            title="Change preorder"
            subtitle={preorder?.product_name}
            icon={<Pencil size={20} color="#1d4ed8" />}
            footer={
                <Pressable
                    onPress={save}
                    disabled={!canSave}
                    accessibilityRole="button"
                    className={`flex-row items-center justify-center gap-2 rounded-2xl bg-brand py-4 ${canSave ? '' : 'opacity-50'}`}
                >
                    {saving ? <ActivityIndicator color="#ffffff" /> : <Pencil size={18} color="#ffffff" />}
                    <Text className="font-sans-bold text-base text-white">Save changes</Text>
                </Pressable>
            }
        >
            {loadFailed ? (
                <Text className="py-6 text-center font-sans text-sm text-slate-500">
                    The item could not be loaded. Close this and try again.
                </Text>
            ) : product === null || preorder === null ? (
                <View className="items-center py-8">
                    <ActivityIndicator color="#0D6EFD" />
                </View>
            ) : (
                <>
                    <Text className="font-sans text-sm text-slate-600">
                        Now: {preorder.variant_label ? `${preorder.variant_label} · ` : ''}
                        {formatUnits(preorder.quantity, 'Piece')}
                    </Text>

                    {product.variants.length > 1 &&
                        product.options.map((option) => (
                            <OptionRow
                                key={option.name}
                                option={option}
                                picked={picked}
                                variants={product.variants}
                                canPick={canPick}
                                tone="amber"
                                onPick={(choice) =>
                                    setPicked(pickChoice(product.variants, product.options, picked, option.name, choice, canPick))
                                }
                            />
                        ))}

                    <View className="gap-2">
                        <Text className="font-sans-bold text-sm text-slate-700">How many?</Text>
                        <QuantityStepper
                            value={quantityText}
                            onChange={setQuantityText}
                            most={most}
                            showLeft={false}
                            unitText={unitWord(quantity, 'Piece')}
                        />
                        {product.variants.length > 1 && variantId === null && (
                            <Text className="font-sans text-sm text-slate-500">{chooseFirstText(product, picked)}</Text>
                        )}
                    </View>

                    <View className="rounded-xl bg-blue-50 px-4 py-3">
                        <Text className="font-sans text-xs leading-5 text-blue-900">
                            {changed && movesToEnd
                                ? 'A bigger quantity or another size or color moves your preorder to the end of the line, behind everyone already waiting.'
                                : 'Only lowering the quantity keeps your place in line. A bigger quantity or another size or color moves it to the end of the line.'}
                        </Text>
                    </View>

                    {error && (
                        <View className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                            <Text className="font-sans-semibold text-sm text-red-700">{error}</Text>
                        </View>
                    )}
                </>
            )}
        </BottomSheet>
    );
}
