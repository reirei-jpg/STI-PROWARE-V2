import { router } from 'expo-router';
import { ClipboardList, TrendingUp, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import BottomSheet from '@/components/BottomSheet';
import CenteredToast, { type ToastMessage } from '@/components/CenteredToast';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatUnits } from '@/lib/format';
import type { StockCardsData } from '@/lib/types';

type CardKey = 'low_stock' | 'best_sellers' | 'ready_to_order';

/**
 * The website dashboard's stock cards on the Specialist's phone To-do: Low
 * stock, Best seller this month, and Ready to order (Coming Soon items whose
 * preorders reached the Maintenance number), where each item gets Create PO
 * or Leave it, like the website.
 */
export default function StockCards({ data, onChanged }: { data: StockCardsData; onChanged: () => void }) {
    const { request } = useAuth();
    const [open, setOpen] = useState<CardKey | null>(null);
    const [busy, setBusy] = useState<number | null>(null);
    const [toast, setToast] = useState<ToastMessage | null>(null);
    const closeToast = useCallback(() => setToast(null), []);
    const top = data.best_sellers.items[0];

    const act = async (path: 'create-po' | 'leave', productId: number): Promise<void> => {
        setBusy(productId);

        try {
            const result = await request<{ message: string }>(`/specialist/preorders/${productId}/${path}`, { method: 'POST' });
            setToast({ type: 'success', message: result.message });
            onChanged();
        } catch (caught) {
            setToast({ type: 'error', message: caught instanceof ApiError ? caught.message : 'It could not be done. Try again.' });
        } finally {
            setBusy(null);
        }
    };

    const createPo = (item: StockCardsData['ready_to_order']['items'][number]): void => {
        // Closing its preorders cannot be undone here, so it asks first.
        Alert.alert(
            `Create a PO for ${item.product_name}?`,
            `Its preorders close now and ${formatUnits(item.pieces, 'Piece')} move to To order on the Preorders page; buyers can no longer preorder it. Then order them in the eStore and scan the PO.`,
            [
                { text: 'Not yet', style: 'cancel' },
                { text: 'Create PO', onPress: () => void act('create-po', item.product_id) },
            ],
        );
    };

    return (
        <View className="gap-2.5">
            <View className="flex-row items-baseline justify-between gap-2 px-1">
                <Text className="font-sans-bold text-xs uppercase tracking-wide text-slate-700">Stock</Text>
                <Text className="font-sans text-xs text-slate-400">Tap a card to see its items.</Text>
            </View>
            <View className="flex-row flex-wrap gap-3">
                <Card
                    icon={TriangleAlert}
                    box="bg-red-50"
                    color="#dc2626"
                    label="Low stock"
                    value={String(data.low_stock.count)}
                    detail={data.low_stock.count === 1 ? 'item low or out of stock' : 'items low or out of stock'}
                    onPress={() => setOpen('low_stock')}
                />
                <Card
                    icon={ClipboardList}
                    box="bg-amber-50"
                    color="#b45309"
                    label="Ready to order"
                    value={String(data.ready_to_order.count)}
                    detail={`with ${data.ready_to_order.threshold}+ pieces preordered`}
                    onPress={() => setOpen('ready_to_order')}
                />
                <Pressable
                    onPress={() => setOpen('best_sellers')}
                    accessibilityRole="button"
                    className="w-full flex-row items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4"
                >
                    <View className="h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
                        <TrendingUp size={19} color="#059669" />
                    </View>
                    <View className="flex-1">
                        <Text className="font-sans-bold text-[11px] uppercase tracking-wide text-slate-500">
                            Best seller this month
                        </Text>
                        <Text numberOfLines={1} className="font-sans-bold text-base text-slate-900">
                            {top ? top.product_name : 'None yet'}
                        </Text>
                        <Text className="font-sans text-xs text-slate-500">
                            {top ? `${formatUnits(top.pieces, 'Piece')} sold` : 'Nothing released this month yet'}
                        </Text>
                    </View>
                </Pressable>
            </View>

            <BottomSheet
                open={open === 'low_stock'}
                onClose={() => setOpen(null)}
                title={`Low stock · ${data.low_stock.count}`}
                subtitle="The emptiest first. Order more in the eStore."
                icon={<TriangleAlert size={20} color="#dc2626" />}
                footer={<CloseButton onPress={() => setOpen(null)} />}
            >
                {data.low_stock.items.length === 0 ? (
                    <Text className="font-sans text-sm text-slate-500">Nothing is low on stock.</Text>
                ) : (
                    <View className="gap-2">
                        {data.low_stock.items.map((item) => (
                            <Pressable
                                key={item.product_id}
                                onPress={() => {
                                    setOpen(null);
                                    router.push(`/stock/${item.product_id}`);
                                }}
                                accessibilityRole="button"
                                className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                            >
                                <Text className="font-sans-bold text-sm text-slate-900">{item.product_name}</Text>
                                <Text
                                    className={`text-xs ${item.out_of_stock ? 'font-sans-bold text-red-600' : 'font-sans text-amber-700'}`}
                                >
                                    {item.out_of_stock
                                        ? 'Out of stock'
                                        : `${formatUnits(item.pieces_left, 'Piece')} left · warned at ${formatUnits(item.warn_at, 'Piece')}`}
                                </Text>
                            </Pressable>
                        ))}
                        {data.low_stock.count > data.low_stock.items.length && (
                            <Text className="font-sans text-xs text-slate-500">
                                Showing {data.low_stock.items.length} of {data.low_stock.count}.
                            </Text>
                        )}
                    </View>
                )}
            </BottomSheet>

            <BottomSheet
                open={open === 'best_sellers'}
                onClose={() => setOpen(null)}
                title="Best sellers this month"
                subtitle={`By pieces released since ${formatDate(data.best_sellers.from)}.`}
                icon={<TrendingUp size={20} color="#059669" />}
                footer={<CloseButton onPress={() => setOpen(null)} />}
            >
                {data.best_sellers.items.length === 0 ? (
                    <Text className="font-sans text-sm text-slate-500">Nothing has been released this month yet.</Text>
                ) : (
                    <View className="gap-2">
                        {data.best_sellers.items.map((item, index) => (
                            <View key={item.product_id} className="flex-row items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                <View className="h-7 w-7 items-center justify-center rounded-full bg-emerald-50">
                                    <Text className="font-sans-bold text-xs text-emerald-700">{index + 1}</Text>
                                </View>
                                <Text numberOfLines={1} className="flex-1 font-sans-bold text-sm text-slate-900">
                                    {item.product_name}
                                </Text>
                                <Text className="font-sans-semibold text-sm text-slate-600">{formatUnits(item.pieces, 'Piece')}</Text>
                            </View>
                        ))}
                    </View>
                )}
            </BottomSheet>

            <BottomSheet
                open={open === 'ready_to_order'}
                onClose={() => setOpen(null)}
                title={`Ready to order · ${data.ready_to_order.count}`}
                subtitle={`Coming Soon items with ${data.ready_to_order.threshold}+ pieces preordered.`}
                icon={<ClipboardList size={20} color="#b45309" />}
                footer={<CloseButton onPress={() => setOpen(null)} />}
            >
                {data.ready_to_order.items.length === 0 ? (
                    <Text className="font-sans text-sm text-slate-500">
                        No Coming Soon item has {data.ready_to_order.threshold} pieces preordered yet.
                    </Text>
                ) : (
                    <View className="gap-2.5">
                        {data.ready_to_order.items.map((item) => (
                            <View key={item.product_id} className="gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                <View>
                                    <Text className="font-sans-bold text-sm text-slate-900">{item.product_name}</Text>
                                    <Text className="font-sans text-xs text-slate-500">
                                        <Text className="font-sans-bold text-amber-700">
                                            {formatUnits(item.pieces, 'Piece')} preordered
                                        </Text>{' '}
                                        ({data.ready_to_order.threshold} needed)
                                        {item.preorders_close_on ? ` · closes ${formatDate(item.preorders_close_on)}` : ''}
                                    </Text>
                                </View>
                                <View className="flex-row gap-2">
                                    <Pressable
                                        onPress={() => createPo(item)}
                                        disabled={busy !== null}
                                        accessibilityRole="button"
                                        className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 ${busy !== null ? 'opacity-60' : ''}`}
                                    >
                                        {busy === item.product_id && <ActivityIndicator size="small" color="#ffffff" />}
                                        <Text className="font-sans-bold text-sm text-white">Create PO</Text>
                                    </Pressable>
                                    <Pressable
                                        onPress={() => void act('leave', item.product_id)}
                                        disabled={busy !== null}
                                        accessibilityRole="button"
                                        className={`flex-1 flex-row items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 ${busy !== null ? 'opacity-60' : ''}`}
                                    >
                                        <Text className="font-sans-bold text-sm text-slate-700">Leave it</Text>
                                    </Pressable>
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </BottomSheet>

            <CenteredToast toast={toast} onClose={closeToast} />
        </View>
    );
}

function Card({
    icon: Icon,
    box,
    color,
    label,
    value,
    detail,
    onPress,
}: {
    icon: LucideIcon;
    box: string;
    color: string;
    label: string;
    value: string;
    detail: string;
    onPress: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`${label}, ${value}`}
            style={{ width: '47.5%' }}
            className="rounded-3xl border border-slate-200 bg-white p-4"
        >
            <View className={`h-9 w-9 items-center justify-center rounded-xl ${box}`}>
                <Icon size={18} color={color} />
            </View>
            <Text className="mt-2.5 font-sans-bold text-[11px] uppercase tracking-wide text-slate-500">{label}</Text>
            <Text className="font-sans-bold text-2xl text-slate-900">{value}</Text>
            <Text numberOfLines={2} className="font-sans text-xs text-slate-500">
                {detail}
            </Text>
        </Pressable>
    );
}

function CloseButton({ onPress }: { onPress: () => void }) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            className="items-center justify-center rounded-2xl border border-slate-200 bg-white py-3.5"
        >
            <Text className="font-sans-bold text-base text-slate-700">Close</Text>
        </Pressable>
    );
}
