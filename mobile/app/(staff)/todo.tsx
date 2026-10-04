import { router, useFocusEffect } from 'expo-router';
import { Banknote, Bell, CircleCheck, Monitor } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatPeso } from '@/lib/format';
import { useNotifications } from '@/lib/notifications';
import type { SpecialistTask, SpecialistTasks } from '@/lib/types';

/** V1's colors for the stripe: blue in progress, amber waiting/today, red urgent. */
function stripeFor(task: SpecialistTask): string {
    switch (task.kind) {
        case 'order':
        case 'delivery':
            return task.title.includes('(late)') ? '#f87171' : '#3b82f6';
        case 'out_of_stock':
            return '#f87171';
        case 'slow_moving':
        case 'more':
            return '#cbd5e1';
        default:
            return '#f59e0b';
    }
}

/** What the button does on the phone. */
function openLabel(target: NonNullable<SpecialistTask['target']>): string {
    if (target.screen === 'order') {
        return 'Open order';
    }

    if (target.screen === 'orders') {
        return 'See all orders';
    }

    if (target.screen === 'record_delivery') {
        return 'Record Delivery';
    }

    return target.id ? 'See stock' : 'See low stock';
}

function open(target: NonNullable<SpecialistTask['target']>): void {
    if (target.screen === 'record_delivery') {
        router.push('/record-delivery');
    } else if (target.screen === 'order' && target.id) {
        router.push(`/staff-order/${target.id}`);
    } else if (target.screen === 'orders') {
        router.navigate('/staff-orders');
    } else if (target.screen === 'stock' && target.id) {
        router.push(`/stock/${target.id}`);
    } else {
        router.navigate({ pathname: '/staff-stock', params: { low: '1' } });
    }
}

/**
 * The Specialist's To-do, the same list as the website dashboard: Do now,
 * Today and This week, most urgent first, plus the cash to collect. A task
 * disappears by itself once it is done. Desk work (linking items, recording
 * deliveries, sales) says to do it on the website.
 */
export default function TodoScreen() {
    const insets = useSafeAreaInsets();
    const { user, request } = useAuth();
    const { unreadCount, refresh: refreshNotifications } = useNotifications();
    const [tasks, setTasks] = useState<SpecialistTasks | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        try {
            setTasks(await request<SpecialistTasks>('/specialist/tasks'));
            setError(null);
        } catch (caught) {
            setError(
                caught instanceof ApiError
                    ? caught.message
                    : 'The to-do list could not be loaded. Pull down to try again.',
            );
        }
    }, [request]);

    useFocusEffect(
        useCallback(() => {
            void load();
            refreshNotifications().catch(() => undefined);
        }, [load, refreshNotifications]),
    );

    const pullToRefresh = async (): Promise<void> => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    const nothingToDo =
        tasks !== null &&
        tasks.now.length === 0 &&
        tasks.today.length === 0 &&
        tasks.week.length === 0;

    return (
        <ScrollView
            className="flex-1 bg-page"
            contentContainerStyle={{
                paddingTop: insets.top + 16,
                paddingBottom: 32,
                paddingHorizontal: 16,
                gap: 16,
            }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} />}
        >
            <View className="rounded-3xl bg-brand px-5 py-6">
                <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                        <Text className="font-sans-semibold text-xs uppercase tracking-wide text-blue-100">
                            PROWARE Specialist
                        </Text>
                        <Text className="mt-1 font-sans-bold text-2xl text-white">
                            Hi, {user?.name.split(' ')[0]}
                        </Text>
                        <Text className="mt-1 font-sans text-sm text-blue-50">
                            What needs doing, most urgent first.
                        </Text>
                    </View>
                    <Pressable
                        onPress={() => router.push('/notifications')}
                        accessibilityRole="button"
                        accessibilityLabel={
                            unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
                        }
                        className="h-11 w-11 items-center justify-center rounded-2xl bg-white/15"
                    >
                        <Bell size={22} color="#ffffff" />
                        {unreadCount > 0 && (
                            <View className="absolute -right-1 -top-1 min-w-5 items-center rounded-full border-2 border-brand bg-red-500 px-1">
                                <Text className="font-sans-bold text-[10px] text-white">
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </Text>
                            </View>
                        )}
                    </Pressable>
                </View>
            </View>

            {error && (
                <View className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                    <Text className="font-sans-semibold text-sm text-red-700">{error}</Text>
                </View>
            )}

            {tasks === null ? (
                !error && <ActivityIndicator color="#0D6EFD" className="mt-10" />
            ) : (
                <>
                    <View className="flex-row gap-3">
                        <CashCard
                            label="To collect"
                            amount={tasks.cash.waiting_centavos}
                            detail={`${tasks.cash.waiting_orders} ${tasks.cash.waiting_orders === 1 ? 'order' : 'orders'} ready for pickup`}
                            tone="amber"
                        />
                        <CashCard
                            label="Collected today"
                            amount={tasks.cash.collected_centavos}
                            detail={`${tasks.cash.collected_orders} ${tasks.cash.collected_orders === 1 ? 'order' : 'orders'} picked up`}
                            tone="green"
                        />
                    </View>

                    {nothingToDo ? (
                        <View className="items-center rounded-3xl border border-emerald-200 bg-emerald-50 px-6 py-10">
                            <CircleCheck size={40} color="#059669" />
                            <Text className="mt-3 font-sans-bold text-lg text-emerald-900">
                                All done
                            </Text>
                            <Text className="mt-1 text-center font-sans text-sm text-emerald-800">
                                Nothing needs doing right now.
                            </Text>
                        </View>
                    ) : (
                        <>
                            <Section title="Do now" tasks={tasks.now} />
                            <Section title="Today" tasks={tasks.today} />
                            <Section title="This week" tasks={tasks.week} />
                        </>
                    )}
                </>
            )}
        </ScrollView>
    );
}

function CashCard({
    label,
    amount,
    detail,
    tone,
}: {
    label: string;
    amount: number;
    detail: string;
    tone: 'amber' | 'green';
}) {
    const classes =
        tone === 'amber' ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50';
    const text = tone === 'amber' ? 'text-amber-800' : 'text-emerald-800';

    return (
        <View className={`flex-1 gap-1 rounded-2xl border px-4 py-3 ${classes}`}>
            <View className="flex-row items-center gap-1.5">
                <Banknote size={15} color={tone === 'amber' ? '#b45309' : '#047857'} />
                <Text className={`font-sans-bold text-xs ${text}`}>{label}</Text>
            </View>
            <Text className="font-sans-bold text-lg text-slate-900">{formatPeso(amount)}</Text>
            <Text className="font-sans text-[11px] text-slate-600">{detail}</Text>
        </View>
    );
}

function Section({ title, tasks }: { title: string; tasks: SpecialistTask[] }) {
    return (
        <View className="gap-2">
            <Text className="font-sans-bold text-base text-slate-900">{title}</Text>
            {tasks.length === 0 ? (
                <Text className="font-sans text-sm text-slate-500">Nothing here.</Text>
            ) : (
                tasks.map((task) => <TaskCard key={task.key} task={task} />)
            )}
        </View>
    );
}

function TaskCard({ task }: { task: SpecialistTask }) {
    return (
        <View
            style={{ borderLeftWidth: 5, borderLeftColor: stripeFor(task) }}
            className="gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3"
        >
            <Text className="font-sans-bold text-sm text-slate-900">{task.title}</Text>
            {task.detail !== '' && (
                <Text className="font-sans text-xs leading-5 text-slate-600">{task.detail}</Text>
            )}
            {task.target ? (
                <Pressable
                    onPress={() => task.target && open(task.target)}
                    accessibilityRole="button"
                    className="self-start rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2"
                >
                    <Text className="font-sans-bold text-sm text-blue-700">
                        {openLabel(task.target)}
                    </Text>
                </Pressable>
            ) : (
                <View className="flex-row items-center gap-1.5">
                    <Monitor size={13} color="#64748b" />
                    <Text className="font-sans-semibold text-xs text-slate-500">
                        Do this on the website ({task.action.label})
                    </Text>
                </View>
            )}
        </View>
    );
}
