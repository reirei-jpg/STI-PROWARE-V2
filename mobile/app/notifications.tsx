import { router, useFocusEffect } from 'expo-router';
import { ArrowLeft, Bell, CheckCheck } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    RefreshControl,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth';
import { formatDate, formatDateTime, formatPeso, formatUnits } from '@/lib/format';
import { noticeTarget } from '@/lib/notice-target';
import { useNotifications } from '@/lib/notifications';
import type { StudentNotification, StudentNotificationData } from '@/lib/types';
import { usePagedList } from '@/lib/use-paged-list';

/**
 * What a notice says, in the website bell's words and V1's colors: green
 * good news (ready), red cancelled or urgent, amber waiting (preorder, low
 * stock), blue in progress (new order, delivery).
 */
function describe(data: StudentNotificationData): {
    title: string;
    body: string;
    titleClass: string;
    stripe: string;
} {
    switch (data.kind) {
        case 'order_ready':
            return {
                title: `Order ${data.order_number} is ready for pickup`,
                body: `Pick it up at the PROWARE office and pay ${formatPeso(data.total_centavos)} in cash${data.pick_up_by ? ` by ${formatDate(data.pick_up_by)}` : ''}.`,
                titleClass: 'text-emerald-700',
                stripe: '#10b981',
            };
        case 'order_cancelled':
            return {
                title: `Order ${data.order_number} was cancelled`,
                body: data.reason ?? 'Please ask the PROWARE office.',
                titleClass: 'text-red-700',
                stripe: '#f87171',
            };
        case 'preorder_arrived':
            return {
                title: `Your preordered item is here: ${data.product_name}`,
                body: 'You can now add it to your cart and order it. It is not held for you, so order soon.',
                titleClass: 'text-amber-800',
                stripe: '#f59e0b',
            };
        // The Specialist's notices, in the bell's words.
        case 'order_placed':
            return {
                title: `New order ${data.order_number}`,
                body: `${data.student_name} · ${data.items_count} ${data.items_count === 1 ? 'item' : 'items'} · ${formatPeso(data.total_centavos)} to pay in cash. Prepare it, then mark it Ready for pickup.`,
                titleClass: 'text-blue-800',
                stripe: '#3b82f6',
            };
        case 'low_stock':
            return {
                title: `${data.stock_on_hand === 0 ? 'Out of stock' : 'Low stock'}: ${data.product_name}`,
                body: `${formatUnits(data.stock_on_hand, 'Piece')} left · you are warned at ${formatUnits(data.alert_at, 'Piece')}. Order more in the eStore.`,
                titleClass: data.stock_on_hand === 0 ? 'text-red-700' : 'text-amber-800',
                stripe: data.stock_on_hand === 0 ? '#f87171' : '#f59e0b',
            };
        case 'delivery_reminder':
            return {
                title: `Delivery expected ${data.when}${data.order_number ? `: Order #${data.order_number}` : ''}`,
                body: `${data.percent_received}% received so far · ${data.quantity_remaining.toLocaleString('en-PH')} still to come (as ordered on the eStore)${data.expected_delivery_date ? ` · ${formatDate(data.expected_delivery_date)}` : ''}. Record it on the website.`,
                titleClass: 'text-blue-800',
                stripe: '#3b82f6',
            };
        case 'sale_ending':
            return {
                title: `Sale ending tomorrow: ${data.product_name}`,
                body: `Ends ${formatDateTime(data.ends_at)}. Extend it on the website, or let it go back to its normal price.`,
                titleClass: 'text-red-700',
                stripe: '#f87171',
            };
        case 'sale_ended':
            return {
                title: `Sale ended: ${data.product_name}`,
                body: `It is back to ${data.normal_price}.`,
                titleClass: 'text-slate-900',
                stripe: '#cbd5e1',
            };
        default:
            return {
                title: 'Notice from the PROWARE office',
                body: '',
                titleClass: 'text-slate-800',
                stripe: '#cbd5e1',
            };
    }
}

/**
 * The signed-in student's or Specialist's notices, newest first, like the
 * website's bell. Tapping one marks it read and opens what it is about (an
 * order, an item, a product's stock) when the phone has a screen for it.
 */
export default function NotificationsScreen() {
    const insets = useSafeAreaInsets();
    const { request } = useAuth();
    const { unreadCount, setUnreadCount } = useNotifications();
    const notices = usePagedList<StudentNotification>('/notifications');
    const [refreshing, setRefreshing] = useState(false);
    const [markingAll, setMarkingAll] = useState(false);
    const { reload } = notices;

    useFocusEffect(
        useCallback(() => {
            void reload();
        }, [reload]),
    );

    const pullToRefresh = async (): Promise<void> => {
        setRefreshing(true);
        await reload();
        setRefreshing(false);
    };

    const open = (notice: StudentNotification): void => {
        if (!notice.read) {
            notices.replaceItem({ ...notice, read: true });
            request<{ unread_count: number }>(`/notifications/${notice.id}/read`, {
                method: 'POST',
            })
                .then((result) => setUnreadCount(result.unread_count))
                .catch(() => undefined);
        }

        const target = noticeTarget(notice.data);

        if (target) {
            router.push(target);
        }
    };

    const markAllRead = async (): Promise<void> => {
        setMarkingAll(true);

        try {
            await request('/notifications/read-all', { method: 'POST' });
            setUnreadCount(0);
            await reload();
        } catch {
            // Pulling down shows the real state.
        } finally {
            setMarkingAll(false);
        }
    };

    const header = (
        <View className="gap-3 pb-2">
            <Pressable
                onPress={() => router.back()}
                accessibilityRole="button"
                className="flex-row items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
                <ArrowLeft size={17} color="#334155" />
                <Text className="font-sans-bold text-sm text-slate-700">Back</Text>
            </Pressable>

            <View className="flex-row items-center justify-between gap-3">
                <View className="flex-1">
                    <Text className="font-sans-bold text-2xl text-slate-900">
                        Notifications
                    </Text>
                    <Text className="font-sans text-sm text-slate-500">
                        {unreadCount > 0 ? `${unreadCount} unread` : 'All read'}
                    </Text>
                </View>
                {unreadCount > 0 && (
                    <Pressable
                        onPress={markAllRead}
                        disabled={markingAll}
                        accessibilityRole="button"
                        className={`flex-row items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2.5 ${markingAll ? 'opacity-60' : ''}`}
                    >
                        <CheckCheck size={16} color="#1d4ed8" />
                        <Text className="font-sans-bold text-sm text-blue-700">
                            Mark all as read
                        </Text>
                    </Pressable>
                )}
            </View>

            {notices.error && (
                <View className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                    <Text className="font-sans-semibold text-sm text-red-700">
                        {notices.error}
                    </Text>
                </View>
            )}
        </View>
    );

    return (
        <FlatList
            className="flex-1 bg-page"
            contentContainerStyle={{
                paddingTop: insets.top + 12,
                paddingBottom: insets.bottom + 32,
                paddingHorizontal: 16,
                gap: 10,
            }}
            data={notices.items ?? []}
            keyExtractor={(notice) => notice.id}
            ListHeaderComponent={header}
            renderItem={({ item }) => <NoticeRow notice={item} onOpen={open} />}
            onEndReached={notices.loadMore}
            onEndReachedThreshold={0.5}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} />}
            ListFooterComponent={
                notices.loadingMore ? <ActivityIndicator color="#0D6EFD" className="py-4" /> : null
            }
            ListEmptyComponent={
                notices.items === null ? (
                    <ActivityIndicator color="#0D6EFD" className="mt-10" />
                ) : (
                    <View className="items-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12">
                        <Bell size={40} color="#cbd5e1" />
                        <Text className="mt-3 font-sans-bold text-lg text-slate-800">
                            No notifications yet
                        </Text>
                        <Text className="mt-1 text-center font-sans text-sm text-slate-500">
                            You will be told here when an order is ready, is
                            cancelled, or a preordered item arrives.
                        </Text>
                    </View>
                )
            }
        />
    );
}

function NoticeRow({
    notice,
    onOpen,
}: {
    notice: StudentNotification;
    onOpen: (notice: StudentNotification) => void;
}) {
    const text = describe(notice.data);

    return (
        <Pressable
            onPress={() => onOpen(notice)}
            accessibilityRole="button"
            accessibilityLabel={`${notice.read ? '' : 'Unread. '}${text.title}`}
            style={{ borderLeftWidth: 5, borderLeftColor: text.stripe }}
            className={`flex-row gap-3 rounded-2xl border px-4 py-3 ${notice.read ? 'border-slate-200 bg-white' : 'border-blue-200 bg-blue-50'}`}
        >
            <View className="flex-1 gap-1">
                <Text className={`font-sans-bold text-sm ${text.titleClass}`}>{text.title}</Text>
                {text.body !== '' && (
                    <Text className="font-sans text-xs leading-5 text-slate-600">{text.body}</Text>
                )}
                <Text className="font-sans text-[11px] text-slate-400">
                    {formatDateTime(notice.created_at)}
                </Text>
            </View>
            {!notice.read && <View className="mt-1.5 h-2.5 w-2.5 rounded-full bg-brand" />}
        </Pressable>
    );
}
