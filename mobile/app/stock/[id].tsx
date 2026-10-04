import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Monitor } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatDateTime, formatUnits } from '@/lib/format';
import type { ProductStockView } from '@/lib/types';

/**
 * One product's stock on the Specialist's phone, as on the website's Stock
 * History page: pieces per size or color (red when out, amber when at or
 * below the warning number) and the latest changes with the balance after.
 */
export default function StockScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const insets = useSafeAreaInsets();
    const { request } = useAuth();
    const [stock, setStock] = useState<ProductStockView | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        request<ProductStockView>(`/specialist/stock/${id}`)
            .then(setStock)
            .catch((caught) =>
                setError(
                    caught instanceof ApiError && caught.status === 404
                        ? 'This product was not found.'
                        : 'The stock could not be loaded. Go back and try again.',
                ),
            );
    }, [id, request]);

    return (
        <ScrollView
            className="flex-1 bg-page"
            contentContainerStyle={{
                paddingTop: insets.top + 12,
                paddingBottom: insets.bottom + 32,
                paddingHorizontal: 16,
                gap: 16,
            }}
        >
            <Pressable
                onPress={() => router.back()}
                accessibilityRole="button"
                className="flex-row items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
                <ArrowLeft size={17} color="#334155" />
                <Text className="font-sans-bold text-sm text-slate-700">Back</Text>
            </Pressable>

            {error ? (
                <Text className="font-sans-semibold text-sm text-red-600">{error}</Text>
            ) : stock === null ? (
                <ActivityIndicator color="#0D6EFD" className="mt-10" />
            ) : (
                <>
                    <View>
                        <Text className="font-sans-bold text-2xl text-slate-900">{stock.product.name}</Text>
                        <Text className="font-sans text-sm text-slate-500">
                            {formatUnits(stock.product.stock_on_hand, 'Piece')} in all · warned at{' '}
                            {formatUnits(stock.product.low_stock_alert_at, 'Piece')}
                        </Text>
                    </View>

                    <View className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
                        {stock.variants.map((variant, position) => {
                            const out = variant.stock_on_hand === 0;
                            const low = !out && variant.stock_on_hand <= stock.product.low_stock_alert_at;

                            return (
                                <View
                                    key={variant.id}
                                    className={`flex-row items-center justify-between gap-3 px-4 py-3 ${position === 0 ? '' : 'border-t border-slate-100'}`}
                                >
                                    <View className="flex-1">
                                        <Text className="font-sans-bold text-sm text-slate-900">
                                            {stock.product.has_options ? variant.label : stock.product.name}
                                        </Text>
                                        {variant.estore_item_code && (
                                            <Text className="font-sans text-xs text-slate-500">
                                                {variant.estore_item_code}
                                            </Text>
                                        )}
                                    </View>
                                    <View
                                        className={`rounded-full px-3 py-1 ${out ? 'bg-red-100' : low ? 'bg-amber-100' : 'bg-slate-100'}`}
                                    >
                                        <Text
                                            className={`font-sans-bold text-xs ${out ? 'text-red-700' : low ? 'text-amber-700' : 'text-slate-700'}`}
                                        >
                                            {out ? 'Out of stock' : formatUnits(variant.stock_on_hand, 'Piece')}
                                        </Text>
                                    </View>
                                </View>
                            );
                        })}
                    </View>

                    <View className="gap-2">
                        <Text className="font-sans-bold text-base text-slate-900">Latest changes</Text>
                        {stock.movements.data.length === 0 ? (
                            <Text className="font-sans text-sm text-slate-500">No changes yet.</Text>
                        ) : (
                            <View className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
                                {stock.movements.data.map((movement, position) => (
                                    <View
                                        key={movement.id}
                                        className={`gap-0.5 px-4 py-3 ${position === 0 ? '' : 'border-t border-slate-100'}`}
                                    >
                                        <View className="flex-row items-center justify-between gap-2">
                                            <Text className="flex-1 font-sans-bold text-sm text-slate-900">
                                                {movement.type_label}
                                                {stock.product.has_options ? ` · ${movement.variant_label}` : ''}
                                            </Text>
                                            <Text
                                                className={`font-sans-bold text-sm ${movement.quantity < 0 ? 'text-red-600' : 'text-emerald-700'}`}
                                            >
                                                {movement.quantity > 0 ? '+' : '−'}
                                                {formatUnits(Math.abs(movement.quantity), 'Piece')}
                                            </Text>
                                        </View>
                                        <Text className="font-sans text-xs text-slate-500">
                                            {formatDateTime(movement.created_at)} · {formatUnits(movement.balance_after, 'Piece')} after
                                        </Text>
                                        {movement.order && (
                                            <Text className="font-sans text-xs text-slate-600">
                                                Order {movement.order.number} · {movement.order.student_name}
                                            </Text>
                                        )}
                                        {movement.delivery && (
                                            <Text className="font-sans text-xs text-slate-600">
                                                Delivery {formatDate(movement.delivery.received_on)}
                                                {movement.delivery.order_number ? ` · Order #${movement.delivery.order_number}` : ''}
                                            </Text>
                                        )}
                                        {(movement.reason_label || movement.note) && (
                                            <Text className="font-sans text-xs text-slate-600">
                                                {[movement.reason_label, movement.note].filter(Boolean).join(' · ')}
                                            </Text>
                                        )}
                                    </View>
                                ))}
                            </View>
                        )}
                        <View className="flex-row items-center gap-1.5">
                            <Monitor size={13} color="#64748b" />
                            <Text className="flex-1 font-sans-semibold text-xs text-slate-500">
                                Older changes and Correct stock are on the website&apos;s Stock History.
                            </Text>
                        </View>
                    </View>
                </>
            )}
        </ScrollView>
    );
}
