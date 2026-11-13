import { router } from 'expo-router';
import { CalendarClock, ClipboardList, Crown, Megaphone, TrendingUp, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';

import BottomSheet from '@/components/BottomSheet';
import CenteredToast, { type ToastMessage } from '@/components/CenteredToast';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatDateTime, formatPeso, formatUnits } from '@/lib/format';
import type { StockCardsData } from '@/lib/types';

type CardKey = 'low_stock' | 'best_sellers' | 'ready_to_order' | 'top_buyers' | 'tell' | 'set_up' | 'dates';

/** "2026-11-14" plus some days, as "2026-11-21". */
function addDays(date: string, days: number): string {
    const [year, month, day] = date.split('-').map(Number);

    return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** How long buyers have to pay, from the start date. */
const PAY_DAYS = [3, 7, 14];

/**
 * The website dashboard's stock cards on the Specialist's phone To-do: Low
 * stock, Best seller this month, and Ready to order (Coming Soon items whose
 * preorders reached the Maintenance number), where each item gets Create PO
 * or Leave it, and Top buyers, where the Specialist can tell the top buyers
 * about a product in stock, like the website.
 */
export default function StockCards({ data, onChanged }: { data: StockCardsData; onChanged: () => void }) {
    const { request } = useAuth();
    const [open, setOpen] = useState<CardKey | null>(null);
    const [busy, setBusy] = useState<number | null>(null);
    const [toast, setToast] = useState<ToastMessage | null>(null);
    const closeToast = useCallback(() => setToast(null), []);
    const top = data.best_sellers.items[0];
    const buyers = data.top_buyers;
    const topBuyer = buyers?.items[0];
    const [productId, setProductId] = useState<number | null>(null);
    const [size, setSize] = useState<number>(buyers?.sizes[0] ?? 10);
    const [note, setNote] = useState('');
    const [sending, setSending] = useState(false);
    // Payment dates: the item, the start (today or tomorrow) and how many days to pay.
    const setUp = data.preorders_to_set_up;
    const [dating, setDating] = useState<{ product_id: number; product_name: string } | null>(null);
    const [startIn, setStartIn] = useState(0);
    const [payDays, setPayDays] = useState(7);
    const [datesError, setDatesError] = useState<string | null>(null);
    const [savingDates, setSavingDates] = useState(false);
    const payFrom = setUp ? addDays(setUp.today, startIn) : '';
    const closeOn = setUp ? addDays(payFrom, payDays) : '';

    const saveDates = async (): Promise<void> => {
        if (!dating) {
            return;
        }

        setSavingDates(true);
        setDatesError(null);

        try {
            const result = await request<{ message: string }>(`/specialist/preorders/${dating.product_id}/payment-dates`, {
                method: 'PATCH',
                body: { preorder_pay_from: payFrom, preorders_close_on: closeOn },
            });
            setOpen(null);
            setDating(null);
            setToast({ type: 'success', message: result.message });
            onChanged();
        } catch (caught) {
            setDatesError(caught instanceof ApiError ? caught.message : 'The dates could not be saved. Try again.');
        } finally {
            setSavingDates(false);
        }
    };    // Shown in the sheet: a toast would be hidden behind it.
    const [tellError, setTellError] = useState<string | null>(null);
    const chosen = buyers?.products.find((product) => product.product_id === productId);
    const recipients = Math.min(size, buyers?.buyers_count ?? 0);

    const send = async (): Promise<void> => {
        if (productId === null) {
            setTellError('Choose the product to announce.');

            return;
        }

        setTellError(null);
        setSending(true);

        try {
            const result = await request<{ message: string }>('/specialist/product-announcements', {
                method: 'POST',
                body: { product_id: productId, top: size, note: note.trim() === '' ? null : note.trim() },
            });
            setOpen(null);
            setProductId(null);
            setNote('');
            setToast({ type: 'success', message: result.message });
            onChanged();
        } catch (caught) {
            setTellError(caught instanceof ApiError ? caught.message : 'It could not be sent. Try again.');
        } finally {
            setSending(false);
        }
    };

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
                {setUp && (
                    <Pressable
                        onPress={() => setOpen('set_up')}
                        accessibilityRole="button"
                        className="w-full flex-row items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4"
                    >
                        <View className="h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
                            <CalendarClock size={19} color="#b45309" />
                        </View>
                        <View className="flex-1">
                            <Text className="font-sans-bold text-[11px] uppercase tracking-wide text-slate-500">
                                Preorders to set up
                            </Text>
                            <Text className="font-sans-bold text-base text-slate-900">{setUp.count}</Text>
                            <Text className="font-sans text-xs text-slate-500">
                                {setUp.count === 1 ? 'item needs payment dates' : 'items need payment dates'}
                            </Text>
                        </View>
                    </Pressable>
                )}
                {buyers && (
                    <Pressable
                        onPress={() => setOpen('top_buyers')}
                        accessibilityRole="button"
                        className="w-full flex-row items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4"
                    >
                        <View className="h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                            <Crown size={19} color="#2563eb" />
                        </View>
                        <View className="flex-1">
                            <Text className="font-sans-bold text-[11px] uppercase tracking-wide text-slate-500">Top buyer</Text>
                            <Text numberOfLines={1} className="font-sans-bold text-base text-slate-900">
                                {topBuyer ? topBuyer.name : 'None yet'}
                            </Text>
                            <Text className="font-sans text-xs text-slate-500">
                                {topBuyer
                                    ? `${formatPeso(topBuyer.spent_centavos)} in the last 3 months`
                                    : 'No released orders in the last 3 months'}
                            </Text>
                        </View>
                    </Pressable>
                )}
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

            {setUp && (
                <BottomSheet
                    open={open === 'set_up'}
                    onClose={() => setOpen(null)}
                    title={`Preorders to set up · ${setUp.count}`}
                    subtitle="Buyers preordered these, but no payment dates are set yet."
                    icon={<CalendarClock size={20} color="#b45309" />}
                    footer={<CloseButton onPress={() => setOpen(null)} />}
                >
                    {setUp.items.length === 0 ? (
                        <Text className="font-sans text-sm text-slate-500">Every item with preorders has its payment dates.</Text>
                    ) : (
                        <View className="gap-2.5">
                            {setUp.items.map((item) => (
                                <View key={item.product_id} className="gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                    <View>
                                        <Text className="font-sans-bold text-sm text-slate-900">{item.product_name}</Text>
                                        <Text className="font-sans text-xs text-slate-500">
                                            <Text className="font-sans-bold text-amber-700">{formatUnits(item.pieces, 'Piece')}</Text>
                                            {` unpaid · ${item.buyers} ${item.buyers === 1 ? 'buyer' : 'buyers'} · ${item.coming_soon ? 'Coming Soon' : 'waiting for restock'}`}
                                        </Text>
                                    </View>
                                    <Pressable
                                        onPress={() => {
                                            setDating(item);
                                            setDatesError(null);
                                            setOpen('dates');
                                        }}
                                        accessibilityRole="button"
                                        className="flex-row items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2"
                                    >
                                        <CalendarClock size={15} color="#ffffff" />
                                        <Text className="font-sans-bold text-sm text-white">Set dates</Text>
                                    </Pressable>
                                </View>
                            ))}
                        </View>
                    )}
                </BottomSheet>
            )}

            {setUp && (
                <BottomSheet
                    open={open === 'dates'}
                    onClose={() => setOpen(null)}
                    title="Payment dates"
                    subtitle={dating?.product_name}
                    icon={<CalendarClock size={20} color="#b45309" />}
                    footer={
                        <View className="gap-2">
                            {datesError && (
                                <View className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                                    <Text className="font-sans-semibold text-sm text-red-700">{datesError}</Text>
                                </View>
                            )}
                            <Pressable
                                onPress={() => void saveDates()}
                                disabled={savingDates}
                                accessibilityRole="button"
                                className={`flex-row items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 ${savingDates ? 'opacity-60' : ''}`}
                            >
                                {savingDates && <ActivityIndicator size="small" color="#ffffff" />}
                                <Text className="font-sans-bold text-base text-white">Save the dates</Text>
                            </Pressable>
                            <Pressable
                                onPress={() => setOpen('set_up')}
                                disabled={savingDates}
                                accessibilityRole="button"
                                className="items-center justify-center rounded-2xl border border-slate-200 bg-white py-3.5"
                            >
                                <Text className="font-sans-bold text-base text-slate-700">Back</Text>
                            </Pressable>
                        </View>
                    }
                >
                    <View className="gap-4">
                        <View className="gap-2">
                            <Text className="font-sans-bold text-sm text-slate-700">Buyers can pay from</Text>
                            <View className="flex-row gap-2">
                                {[0, 1].map((days) => (
                                    <Pressable
                                        key={days}
                                        onPress={() => setStartIn(days)}
                                        accessibilityRole="radio"
                                        accessibilityState={{ selected: startIn === days }}
                                        className={`flex-1 items-center rounded-xl border py-2.5 ${startIn === days ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white'}`}
                                    >
                                        <Text className={`font-sans-bold text-sm ${startIn === days ? 'text-blue-700' : 'text-slate-600'}`}>
                                            {days === 0 ? 'Today' : 'Tomorrow'}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>
                        <View className="gap-2">
                            <Text className="font-sans-bold text-sm text-slate-700">Days to pay</Text>
                            <View className="flex-row gap-2">
                                {PAY_DAYS.map((days) => (
                                    <Pressable
                                        key={days}
                                        onPress={() => setPayDays(days)}
                                        accessibilityRole="radio"
                                        accessibilityState={{ selected: payDays === days }}
                                        className={`flex-1 items-center rounded-xl border py-2.5 ${payDays === days ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white'}`}
                                    >
                                        <Text className={`font-sans-bold text-sm ${payDays === days ? 'text-blue-700' : 'text-slate-600'}`}>
                                            {days} days
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>
                        <View className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                            <Text className="font-sans-bold text-sm text-amber-900">
                                Pay {formatDate(payFrom)} to {formatDate(closeOn)}
                            </Text>
                            <Text className="font-sans text-xs leading-5 text-amber-900">
                                Buyers with unpaid preorders are told to pay at the cashier by then. Preorders not paid by the
                                end of {formatDate(closeOn)} are dropped. Other dates can be set on the website.
                            </Text>
                        </View>
                    </View>
                </BottomSheet>
            )}

            {buyers && (
                <BottomSheet
                    open={open === 'top_buyers'}
                    onClose={() => setOpen(null)}
                    title="Top buyers"
                    subtitle={`Who spent the most on released orders since ${formatDate(buyers.from)} (${buyers.buyers_count} in all).`}
                    icon={<Crown size={20} color="#2563eb" />}
                    footer={
                        <View className="gap-2">
                            <Pressable
                                onPress={() => setOpen('tell')}
                                disabled={buyers.items.length === 0 || buyers.products.length === 0}
                                accessibilityRole="button"
                                className={`flex-row items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 ${buyers.items.length === 0 || buyers.products.length === 0 ? 'opacity-60' : ''}`}
                            >
                                <Megaphone size={17} color="#ffffff" />
                                <Text className="font-sans-bold text-base text-white">Tell top buyers</Text>
                            </Pressable>
                            <CloseButton onPress={() => setOpen(null)} />
                        </View>
                    }
                >
                    {buyers.items.length === 0 ? (
                        <Text className="font-sans text-sm text-slate-500">No orders were released in the last 3 months.</Text>
                    ) : (
                        <View className="gap-2">
                            {buyers.items.map((buyer, index) => (
                                <View key={buyer.user_id} className="flex-row items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                    <View className="h-7 w-7 items-center justify-center rounded-full bg-blue-50">
                                        <Text className="font-sans-bold text-xs text-blue-700">{index + 1}</Text>
                                    </View>
                                    <View className="flex-1">
                                        <Text numberOfLines={1} className="font-sans-bold text-sm text-slate-900">
                                            {buyer.name}
                                        </Text>
                                        <Text numberOfLines={1} className="font-sans text-xs text-slate-500">
                                            {buyer.orders} {buyer.orders === 1 ? 'order' : 'orders'} · {formatUnits(buyer.pieces, 'Piece')}
                                        </Text>
                                    </View>
                                    <Text className="font-sans-bold text-sm text-slate-900">{formatPeso(buyer.spent_centavos)}</Text>
                                </View>
                            ))}
                            <Text className="font-sans text-xs text-slate-500">
                                {buyers.last
                                    ? `Last sent: ${buyers.last.product_name} to ${buyers.last.recipients} ${buyers.last.recipients === 1 ? 'buyer' : 'buyers'}, ${formatDateTime(buyers.last.sent_at)}${buyers.last.sent_by ? ` by ${buyers.last.sent_by}` : ''}.`
                                    : 'Nothing announced yet.'}
                            </Text>
                        </View>
                    )}
                </BottomSheet>
            )}

            {buyers && (
                <BottomSheet
                    open={open === 'tell'}
                    onClose={() => setOpen(null)}
                    title="Tell top buyers"
                    subtitle="They get a notice and a phone notification. A product can be announced once a day."
                    icon={<Megaphone size={20} color="#2563eb" />}
                    footer={
                        <View className="gap-2">
                            {tellError && (
                                <View className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                                    <Text className="font-sans-semibold text-sm text-red-700">{tellError}</Text>
                                </View>
                            )}
                            <Pressable
                                onPress={() => void send()}
                                disabled={sending}
                                accessibilityRole="button"
                                className={`flex-row items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 ${sending ? 'opacity-60' : ''}`}
                            >
                                {sending ? <ActivityIndicator size="small" color="#ffffff" /> : <Megaphone size={17} color="#ffffff" />}
                                <Text className="font-sans-bold text-base text-white">
                                    Send to {recipients} {recipients === 1 ? 'buyer' : 'buyers'}
                                </Text>
                            </Pressable>
                            <Pressable
                                onPress={() => {
                                    setTellError(null);
                                    setOpen('top_buyers');
                                }}
                                disabled={sending}
                                accessibilityRole="button"
                                className="items-center justify-center rounded-2xl border border-slate-200 bg-white py-3.5"
                            >
                                <Text className="font-sans-bold text-base text-slate-700">Back</Text>
                            </Pressable>
                        </View>
                    }
                >
                    <View className="gap-4">
                        <View className="gap-2">
                            <Text className="font-sans-bold text-sm text-slate-700">Product in stock (the latest to arrive first)</Text>
                            {buyers.products.map((product) => {
                                const picked = product.product_id === productId;

                                return (
                                    <Pressable
                                        key={product.product_id}
                                        onPress={() => {
                                            setProductId(product.product_id);
                                            setTellError(null);
                                        }}
                                        accessibilityRole="radio"
                                        accessibilityState={{ selected: picked }}
                                        className={`rounded-2xl border px-4 py-3 ${picked ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white'}`}
                                    >
                                        <Text className={`font-sans-bold text-sm ${picked ? 'text-blue-800' : 'text-slate-900'}`}>
                                            {product.product_name}
                                        </Text>
                                        <Text className="font-sans text-xs text-slate-500">
                                            {[
                                                product.arrived_on ? `Arrived ${formatDate(product.arrived_on)}` : null,
                                                product.announced_at ? `announced ${formatDate(product.announced_at.slice(0, 10))}` : null,
                                            ]
                                                .filter(Boolean)
                                                .join(' · ') || 'In stock'}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        <View className="gap-2">
                            <Text className="font-sans-bold text-sm text-slate-700">Tell</Text>
                            <View className="flex-row gap-2">
                                {buyers.sizes.map((option) => (
                                    <Pressable
                                        key={option}
                                        onPress={() => setSize(option)}
                                        accessibilityRole="radio"
                                        accessibilityState={{ selected: size === option }}
                                        className={`flex-1 items-center rounded-xl border py-2.5 ${size === option ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white'}`}
                                    >
                                        <Text className={`font-sans-bold text-sm ${size === option ? 'text-blue-700' : 'text-slate-600'}`}>Top {option}</Text>
                                    </Pressable>
                                ))}
                            </View>
                            <Text className="font-sans text-xs text-slate-500">
                                {buyers.buyers_count < size
                                    ? `Only ${buyers.buyers_count} ${buyers.buyers_count === 1 ? 'buyer has' : 'buyers have'} bought in the last 3 months.`
                                    : `The ${size} buyers who spent the most in the last 3 months.`}
                            </Text>
                        </View>

                        <View className="gap-2">
                            <Text className="font-sans-bold text-sm text-slate-700">Note (optional)</Text>
                            <TextInput
                                value={note}
                                onChangeText={setNote}
                                maxLength={120}
                                placeholder="e.g. Limited stock."
                                placeholderTextColor="#94a3b8"
                                className="rounded-xl border border-slate-200 bg-white px-3 py-3 font-sans-medium text-sm text-slate-900"
                            />
                        </View>

                        <View className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                            <Text className="font-sans-bold text-[11px] uppercase tracking-wide text-blue-700">What they will see</Text>
                            <Text className="mt-1 font-sans-bold text-sm text-slate-900">
                                New in the store: {chosen ? chosen.product_name : '…'}
                            </Text>
                            <Text className="font-sans text-sm text-slate-600">
                                It is in stock now
                                {chosen && chosen.price_from_centavos !== null
                                    ? chosen.price_from_centavos === chosen.price_to_centavos
                                        ? ` at ${formatPeso(chosen.price_from_centavos)}`
                                        : ` from ${formatPeso(chosen.price_from_centavos)}`
                                    : ''}
                                .{note.trim() ? ` ${note.trim()}` : ''}
                            </Text>
                        </View>
                    </View>
                </BottomSheet>
            )}

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
