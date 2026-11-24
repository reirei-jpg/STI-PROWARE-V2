import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Monitor } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LoadError from '@/components/LoadError';
import LoadingState from '@/components/LoadingState';
import { ApiError, loadErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatDateTime, formatUnits } from '@/lib/format';
import type { ProductStockView, ReorderView } from '@/lib/types';

/** Reorder status colors, as on the website (V1's): red, amber, blue, green. */
const reorderTone: Record<ReorderView['status'], { box: string; text: string }> = {
    out_of_stock: { box: 'bg-red-100', text: 'text-red-700' },
    reorder: { box: 'bg-amber-100', text: 'text-amber-700' },
    on_order: { box: 'bg-blue-100', text: 'text-blue-700' },
    ok: { box: 'bg-emerald-100', text: 'text-emerald-700' },
};

/** "Reorder Point 19 pcs · order 34 pcs · 20 pcs on order". */
function reorderLine(reorder: ReorderView): string {
    return [
        `Reorder Point ${formatUnits(reorder.reorder_point, 'Piece')}`,
        reorder.suggested > 0 ? `order ${formatUnits(reorder.suggested, 'Piece')}` : null,
        reorder.on_order > 0 ? `${formatUnits(reorder.on_order, 'Piece')} on order` : null,
    ]
        .filter(Boolean)
        .join(' · ');
}

/**
 * One product's stock on the Specialist's phone, as on the website's Stock
 * History page: pieces per size or color with its reorder status (Out of
 * stock, Reorder now, On order, OK), its Reorder Point and how many to
 * order, and the latest changes with the balance after.
 */
export default function StockScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const insets = useSafeAreaInsets();
    const { request } = useAuth();
    const [stock, setStock] = useState<ProductStockView | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(
        () =>
            request<ProductStockView>(`/specialist/stock/${id}`)
                .then((loaded) => {
                    setStock(loaded);
                    setError(null);
                })
                .catch((caught) =>
                    setError(
                        caught instanceof ApiError && caught.status === 404
                            ? 'This product was not found.'
                            : loadErrorMessage(caught, 'The stock could not be loaded.'),
                    ),
                ),
        [id, request],
    );

    useEffect(() => {
        void load();
    }, [load]);

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

            {error && stock === null ? (
                <LoadError message={error} onRetry={load} className="" />
            ) : stock === null ? (
                <LoadingState />
            ) : (
                <>
                    <View>
                        <Text className="font-sans-bold text-2xl text-slate-900">{stock.product.name}</Text>
                        <Text className="font-sans text-sm text-slate-500">
                            {formatUnits(stock.product.stock_on_hand, 'Piece')} in all
                            {stock.product.is_sold
                                ? ` · safety stock ${formatUnits(stock.product.low_stock_alert_at, 'Piece')}${stock.product.lead_days ? ` · Head Office delivers in ${stock.product.lead_days} ${stock.product.lead_days === 1 ? 'day' : 'days'}` : ''}`
                                : ' · not watched for reorder'}
                        </Text>
                    </View>

                    <View className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
                        {stock.variants.map((variant, position) => {
                            // A Draft size is not sold yet, so it is never low or out of stock.
                            const out = !variant.is_draft && variant.stock_on_hand === 0;
                            const reorder = variant.reorder ?? null;
                            const tone = reorder && reorder.status !== 'ok' ? reorderTone[reorder.status] : null;

                            return (
                                <View
                                    key={variant.id}
                                    className={`gap-1 px-4 py-3 ${position === 0 ? '' : 'border-t border-slate-100'}`}
                                >
                                    <View className="flex-row items-center justify-between gap-3">
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
                                        <Text className={`font-sans-bold text-sm ${out ? 'text-red-600' : 'text-slate-800'}`}>
                                            {variant.is_draft && variant.stock_on_hand === 0
                                                ? 'Draft'
                                                : out
                                                  ? 'Out of stock'
                                                  : formatUnits(variant.stock_on_hand, 'Piece')}
                                        </Text>
                                    </View>
                                    {reorder && (
                                        <View className="flex-row flex-wrap items-center gap-2">
                                            {tone && (
                                                <Text className={`rounded-full px-2.5 py-0.5 font-sans-bold text-xs ${tone.box} ${tone.text}`}>
                                                    {reorder.status_label}
                                                </Text>
                                            )}
                                            <Text className="flex-1 font-sans text-xs text-slate-500">{reorderLine(reorder)}</Text>
                                        </View>
                                    )}
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
