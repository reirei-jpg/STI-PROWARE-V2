import { router, useFocusEffect } from 'expo-router';
import {
    Banknote,
    CircleCheck,
    ImageIcon,
    ShoppingCart,
    Trash2,
    TriangleAlert,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import OrderItemsList from '@/components/OrderItemsList';
import QuantityStepper from '@/components/QuantityStepper';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { formatDate, formatPeso, formatUnits, unitWord } from '@/lib/format';
import type { CartLine, CartView, StudentOrder } from '@/lib/types';

/**
 * The cart at today's prices, and Place Order, like the website. The
 * student pays in cash at the PROWARE office when picking it up; the items
 * are held for them until the pick-up date.
 */
export default function CartScreen() {
    const insets = useSafeAreaInsets();
    const { request } = useAuth();
    const { cart, refresh, replace } = useCart();
    const [refreshing, setRefreshing] = useState(false);
    const [placing, setPlacing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [placed, setPlaced] = useState<{ message: string; order: StudentOrder } | null>(
        null,
    );

    // Prices and stock may have changed since it was last opened.
    useFocusEffect(
        useCallback(() => {
            refresh().catch(() => undefined);
        }, [refresh]),
    );

    const pullToRefresh = async (): Promise<void> => {
        setRefreshing(true);
        await refresh().catch(() =>
            setError('The cart could not be loaded. Pull down to try again.'),
        );
        setRefreshing(false);
    };

    const placeOrder = async (): Promise<void> => {
        setPlacing(true);
        setError(null);

        try {
            const result = await request<{ message: string; order: StudentOrder }>(
                '/orders',
                { method: 'POST' },
            );

            setPlaced(result);
            await refresh();
        } catch (caught) {
            setError(
                caught instanceof ApiError
                    ? caught.message
                    : 'The order could not be placed. Please try again.',
            );
            // The cart may have changed (for example, an item sold out).
            refresh().catch(() => undefined);
        } finally {
            setPlacing(false);
        }
    };

    if (placed) {
        return (
            <OrderPlaced
                message={placed.message}
                order={placed.order}
                onDone={(next) => {
                    setPlaced(null);
                    router.navigate(next === 'orders' ? '/orders?show=orders' : '/');
                }}
            />
        );
    }

    const lines = cart?.lines ?? [];

    return (
        <View className="flex-1 bg-page">
            <ScrollView
                contentContainerStyle={{
                    paddingTop: insets.top + 16,
                    paddingBottom: 24,
                    paddingHorizontal: 16,
                    gap: 16,
                }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} />
                }
                keyboardShouldPersistTaps="handled"
            >
                <View>
                    <Text className="font-sans-bold text-2xl text-slate-900">Cart</Text>
                    <Text className="mt-1 font-sans text-sm text-slate-500">
                        Prices are today&apos;s. They are kept once you place the order.
                    </Text>
                </View>

                {cart === null ? (
                    <ActivityIndicator color="#0D6EFD" className="mt-10" />
                ) : lines.length === 0 ? (
                    <View className="items-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12">
                        <ShoppingCart size={40} color="#cbd5e1" />
                        <Text className="mt-3 font-sans-bold text-lg text-slate-800">
                            Your cart is empty
                        </Text>
                        <Text className="mt-1 text-center font-sans text-sm text-slate-500">
                            Tap Add to Cart on an item in the store.
                        </Text>
                        <Pressable
                            onPress={() => router.navigate('/')}
                            accessibilityRole="button"
                            className="mt-5 rounded-2xl bg-brand px-6 py-3"
                        >
                            <Text className="font-sans-bold text-sm text-white">
                                Go to the store
                            </Text>
                        </Pressable>
                    </View>
                ) : (
                    <View className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
                        {lines.map((line, position) => (
                            <CartLineRow
                                key={line.id}
                                line={line}
                                first={position === 0}
                                onChanged={replace}
                            />
                        ))}
                    </View>
                )}
            </ScrollView>

            {cart !== null && lines.length > 0 && (
                <View
                    style={{ paddingBottom: 12 }}
                    className="gap-3 border-t border-slate-200 bg-white px-4 pt-3"
                >
                    <View className="flex-row items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2.5">
                        <Banknote size={18} color="#047857" />
                        <Text className="flex-1 font-sans text-xs leading-5 text-emerald-900">
                            Pay in cash at the PROWARE office when you pick it up. Pick
                            it up by{' '}
                            <Text className="font-sans-bold">{formatDate(cart.pick_up_by)}</Text>
                            , or the order is cancelled.
                        </Text>
                    </View>

                    {error && (
                        <Text className="font-sans-semibold text-sm text-red-600">{error}</Text>
                    )}
                    {!cart.can_place_order && (
                        <Text className="font-sans-semibold text-sm text-red-600">
                            Fix the items marked in red first.
                        </Text>
                    )}

                    <View className="flex-row items-center gap-3">
                        <View className="flex-1">
                            <Text className="font-sans text-xs text-slate-500">Total</Text>
                            <Text className="font-sans-bold text-xl text-slate-900">
                                {formatPeso(cart.total_centavos)}
                            </Text>
                        </View>
                        <Pressable
                            onPress={placeOrder}
                            disabled={!cart.can_place_order || placing}
                            accessibilityRole="button"
                            className={`flex-row items-center gap-2 rounded-2xl bg-brand px-6 py-4 ${!cart.can_place_order || placing ? 'opacity-50' : ''}`}
                        >
                            {placing && <ActivityIndicator color="#ffffff" />}
                            <Text className="font-sans-bold text-base text-white">
                                Place Order
                            </Text>
                        </Pressable>
                    </View>
                </View>
            )}
        </View>
    );
}

function CartLineRow({
    line,
    first,
    onChanged,
}: {
    line: CartLine;
    first: boolean;
    onChanged: (cart: CartView) => void;
}) {
    const { request } = useAuth();
    const [quantityText, setQuantityText] = useState(String(line.quantity));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Follow the server's number (after a save, or when the cart reloads).
    useEffect(() => {
        setQuantityText(String(line.quantity));
    }, [line.quantity]);

    const save = async (value: number): Promise<void> => {
        setQuantityText(String(value));

        if (value === line.quantity) {
            return;
        }

        setBusy(true);

        try {
            const result = await request<{ cart: CartView }>(`/cart/${line.id}`, {
                method: 'PATCH',
                body: { quantity: value },
            });

            setError(null);
            onChanged(result.cart);
        } catch (caught) {
            setError(
                caught instanceof ApiError ? caught.message : 'It could not be changed.',
            );
            setQuantityText(String(line.quantity));
        } finally {
            setBusy(false);
        }
    };

    const remove = (): void => {
        Alert.alert('Remove from cart?', line.product_name, [
            { text: 'Keep it', style: 'cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: async () => {
                    setBusy(true);

                    try {
                        const result = await request<{ cart: CartView }>(`/cart/${line.id}`, {
                            method: 'DELETE',
                        });

                        onChanged(result.cart);
                    } catch {
                        setError('It could not be removed. Please try again.');
                        setBusy(false);
                    }
                },
            },
        ]);
    };

    return (
        <View
            className={`gap-3 p-4 ${first ? '' : 'border-t border-slate-100'} ${line.problem ? 'bg-red-50/60' : ''} ${busy ? 'opacity-60' : ''}`}
        >
            <View className="flex-row gap-3">
                <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                    {line.photo_url ? (
                        <Image
                            source={{ uri: line.photo_url }}
                            style={{ width: 64, height: 64 }}
                            resizeMode="cover"
                        />
                    ) : (
                        <ImageIcon size={22} color="#cbd5e1" />
                    )}
                </View>

                <View className="flex-1 gap-0.5">
                    <Text className="font-sans-bold text-base text-slate-900">
                        {line.product_name}
                    </Text>
                    <Text className="font-sans text-sm text-slate-600">
                        {line.variant_label ? `${line.variant_label} · ` : ''}
                        {line.pieces_per_unit > 1
                            ? `${line.unit_name} of ${line.pieces_per_unit}`
                            : 'By the piece'}
                    </Text>
                    {line.unit_price_centavos !== null && (
                        <Text
                            className={`font-sans-bold text-sm ${line.on_sale ? 'text-red-600' : 'text-blue-700'}`}
                        >
                            {formatPeso(line.unit_price_centavos)}
                            <Text className="font-sans text-slate-500">
                                {' '}
                                / {line.pieces_per_unit > 1 ? line.unit_name : 'pc'}
                                {line.on_sale ? ' · On sale' : ''}
                            </Text>
                        </Text>
                    )}
                </View>

                <Pressable
                    onPress={remove}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${line.product_name}`}
                    className="h-10 w-10 items-center justify-center rounded-xl border border-red-200 bg-red-50"
                >
                    <Trash2 size={17} color="#dc2626" />
                </Pressable>
            </View>

            {line.problem && (
                <View className="flex-row items-start gap-1.5">
                    <TriangleAlert size={15} color="#b91c1c" />
                    <Text className="flex-1 font-sans-bold text-sm text-red-700">
                        {line.problem}
                    </Text>
                </View>
            )}
            {error && (
                <Text className="font-sans-semibold text-sm text-red-600">{error}</Text>
            )}

            <View className="flex-row items-center gap-3">
                <View className="flex-1">
                    <QuantityStepper
                        value={quantityText}
                        onChange={setQuantityText}
                        onCommit={(quantity) => void save(quantity)}
                        most={Math.max(line.most_allowed, 1)}
                        unitText={`${unitWord(line.quantity, line.unit_name)}${
                            line.pieces_per_unit > 1
                                ? ` (${formatUnits(line.quantity * line.pieces_per_unit, 'Piece')})`
                                : ''
                        }`}
                        disabled={busy}
                    />
                </View>
                <Text className="font-sans-bold text-base text-slate-900">
                    {line.unit_price_centavos !== null
                        ? formatPeso(line.line_total_centavos)
                        : '—'}
                </Text>
            </View>
        </View>
    );
}

function OrderPlaced({
    message,
    order,
    onDone,
}: {
    message: string;
    order: StudentOrder;
    onDone: (next: 'orders' | 'store') => void;
}) {
    const insets = useSafeAreaInsets();

    return (
        <ScrollView
            className="flex-1 bg-page"
            contentContainerStyle={{
                paddingTop: insets.top + 24,
                paddingBottom: 32,
                paddingHorizontal: 16,
                gap: 16,
            }}
        >
            <View className="items-center gap-2 rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-6">
                <CircleCheck size={44} color="#059669" />
                <Text className="font-sans-bold text-xl text-emerald-900">
                    Order {order.number} placed
                </Text>
                <Text className="text-center font-sans text-sm leading-5 text-emerald-900">
                    {message}
                </Text>
            </View>

            <View className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
                <OrderItemsList order={order} />
            </View>

            <View className="gap-3">
                <Pressable
                    onPress={() => onDone('orders')}
                    accessibilityRole="button"
                    className="items-center rounded-2xl bg-brand py-4"
                >
                    <Text className="font-sans-bold text-base text-white">See My Orders</Text>
                </Pressable>
                <Pressable
                    onPress={() => onDone('store')}
                    accessibilityRole="button"
                    className="items-center rounded-2xl border border-slate-200 bg-white py-4"
                >
                    <Text className="font-sans-bold text-base text-slate-700">
                        Back to the store
                    </Text>
                </Pressable>
            </View>
        </ScrollView>
    );
}
