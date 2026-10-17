import { router, useFocusEffect } from 'expo-router';
import {
    ArrowRight,
    Bell,
    Boxes,
    CalendarClock,
    CalendarDays,
    ChevronRight,
    CircleCheck,
    Flame,
    Hourglass,
    Link2,
    Monitor,
    PackageCheck,
    ScanLine,
    ShoppingBag,
    Snail,
    TriangleAlert,
    Truck,
    type LucideIcon,
} from 'lucide-react-native';
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

import BottomSheet from '@/components/BottomSheet';
import StaffOrderRow from '@/components/StaffOrderRow';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useNotifications } from '@/lib/notifications';
import type { OrderCardKey, SpecialistTask, SpecialistTasks } from '@/lib/types';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The website dashboard's four student order cards, in its V1 colors. */
const orderCards: { key: OrderCardKey; label: string; detail: string; icon: LucideIcon; box: string; color: string }[] = [
    { key: 'new', label: 'New', detail: 'to prepare', icon: ShoppingBag, box: 'bg-amber-50', color: '#b45309' },
    { key: 'ready', label: 'Ready for pickup', detail: 'waiting for the student', icon: PackageCheck, box: 'bg-blue-50', color: '#1d4ed8' },
    { key: 'last_day', label: 'Last day today', detail: 'cancels tonight if not picked up', icon: Hourglass, box: 'bg-red-50', color: '#b91c1c' },
    { key: 'released_today', label: 'Released today', detail: 'paid and handed over', icon: CircleCheck, box: 'bg-emerald-50', color: '#047857' },
];

type TaskGroup = 'now' | 'today' | 'week';

/** The website dashboard's three task cards. */
const taskGroups: { key: TaskGroup; label: string; icon: LucideIcon; box: string; color: string; dot: string }[] = [
    { key: 'now', label: 'Do now', icon: Flame, box: 'bg-red-50', color: '#b91c1c', dot: 'bg-red-500' },
    { key: 'today', label: 'Today', icon: CalendarClock, box: 'bg-amber-50', color: '#b45309', dot: 'bg-amber-400' },
    { key: 'week', label: 'This week', icon: CalendarDays, box: 'bg-blue-50', color: '#1d4ed8', dot: 'bg-blue-500' },
];

/**
 * Each kind of task's icon and V1 color, the same as the website dashboard:
 * blue in progress, amber waiting, red urgent, green good, grey quiet.
 */
const taskLooks: Record<string, { icon: LucideIcon; box: string; color: string }> = {
    below_cost: { icon: TriangleAlert, box: 'bg-red-50', color: '#b91c1c' },
    low_stock: { icon: TriangleAlert, box: 'bg-amber-50', color: '#b45309' },
    out_of_stock: { icon: TriangleAlert, box: 'bg-red-50', color: '#b91c1c' },
    split: { icon: Boxes, box: 'bg-emerald-50', color: '#047857' },
    link: { icon: Link2, box: 'bg-amber-50', color: '#b45309' },
    delivery: { icon: Truck, box: 'bg-blue-50', color: '#1d4ed8' },
    sale_ending: { icon: Flame, box: 'bg-red-50', color: '#dc2626' },
    preorders: { icon: CalendarClock, box: 'bg-amber-50', color: '#b45309' },
    slow_moving: { icon: Snail, box: 'bg-slate-100', color: '#475569' },
    more: { icon: ArrowRight, box: 'bg-slate-100', color: '#475569' },
};

/** What the button does on the phone. */
function openLabel(target: NonNullable<SpecialistTask['target']>): string {
    if (target.screen === 'record_delivery') {
        return 'Record Delivery';
    }

    return target.id ? 'See stock' : 'See low stock';
}

function open(target: NonNullable<SpecialistTask['target']>): void {
    if (target.screen === 'record_delivery') {
        router.push('/record-delivery');
    } else if (target.screen === 'stock' && target.id) {
        router.push(`/stock/${target.id}`);
    } else {
        router.navigate({ pathname: '/staff-stock', params: { low: '1' } });
    }
}

/** Tasks in a group; an "and N more" line counts as the N tasks it stands for. */
function countTasks(tasks: SpecialistTask[]): number {
    return tasks.reduce((sum, task) => sum + (task.kind === 'more' ? (task.hidden ?? 0) : 1), 0);
}

/**
 * The Specialist's To-do, the same as the website dashboard: a greeting
 * with today's date, Scan issuance slip and Record Delivery, the four
 * student order cards, and the Do now / Today / This week task cards. A
 * card opens its orders or tasks in a panel, so the screen stays short.
 * Desk work (linking items, prices) says to do it on the website.
 */
export default function TodoScreen() {
    const insets = useSafeAreaInsets();
    const { user, request } = useAuth();
    const { unreadCount, refresh: refreshNotifications } = useNotifications();
    const [tasks, setTasks] = useState<SpecialistTasks | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [openCard, setOpenCard] = useState<OrderCardKey | null>(null);
    const [openGroup, setOpenGroup] = useState<TaskGroup | null>(null);

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

    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const today = `${WEEKDAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`;

    const card = orderCards.find((one) => one.key === openCard);
    const group = taskGroups.find((one) => one.key === openGroup);

    return (
        <>
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
                <View className="gap-4 rounded-3xl bg-brand px-5 py-5">
                    <View className="flex-row items-start justify-between gap-3">
                        <View className="flex-1">
                            <Text className="font-sans-semibold text-xs uppercase tracking-wide text-blue-100">
                                {today}
                            </Text>
                            <Text className="mt-1 font-sans-bold text-2xl text-white">
                                {greeting}, {user?.name.split(' ')[0]}
                            </Text>
                            <Text className="mt-0.5 font-sans text-sm text-blue-50">
                                Here is what needs you, most urgent first.
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

                    <View className="flex-row gap-3">
                        <Pressable
                            onPress={() => router.push('/scan-slip')}
                            accessibilityRole="button"
                            className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-white py-3.5"
                        >
                            <ScanLine size={18} color="#0D6EFD" />
                            <Text className="font-sans-bold text-sm text-brand">Scan slip</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => router.push('/record-delivery')}
                            accessibilityRole="button"
                            className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-blue-300 bg-white/15 py-3.5"
                        >
                            <Truck size={18} color="#ffffff" />
                            <Text className="font-sans-bold text-sm text-white">Record Delivery</Text>
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
                        <View className="gap-2.5">
                            <SectionTitle title="Student orders" hint="Tap a card to see its orders." />
                            <View className="flex-row flex-wrap gap-3">
                                {orderCards.map((one) => (
                                    <Pressable
                                        key={one.key}
                                        onPress={() => setOpenCard(one.key)}
                                        accessibilityRole="button"
                                        accessibilityLabel={`${one.label}, ${tasks.order_cards[one.key].count}`}
                                        style={{ width: '47.5%' }}
                                        className="rounded-3xl border border-slate-200 bg-white p-4"
                                    >
                                        <View className={`h-9 w-9 items-center justify-center rounded-xl ${one.box}`}>
                                            <one.icon size={18} color={one.color} />
                                        </View>
                                        <Text className="mt-2.5 font-sans-bold text-[11px] uppercase tracking-wide text-slate-500">
                                            {one.label}
                                        </Text>
                                        <Text className="font-sans-bold text-2xl text-slate-900">
                                            {tasks.order_cards[one.key].count}
                                        </Text>
                                        <Text numberOfLines={2} className="font-sans text-xs text-slate-500">
                                            {one.detail}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>

                        <View className="gap-2.5">
                            <SectionTitle title="Your tasks" hint="Tap a card to see its tasks." />
                            {taskGroups.map((one) => {
                                const count = countTasks(tasks[one.key]);
                                const first = tasks[one.key][0];

                                return (
                                    <Pressable
                                        key={one.key}
                                        onPress={() => setOpenGroup(one.key)}
                                        accessibilityRole="button"
                                        accessibilityLabel={`${one.label}, ${count} ${count === 1 ? 'task' : 'tasks'}`}
                                        className="flex-row items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4"
                                    >
                                        <View className={`h-10 w-10 items-center justify-center rounded-xl ${one.box}`}>
                                            <one.icon size={19} color={one.color} />
                                        </View>
                                        <View className="flex-1">
                                            <View className="flex-row items-center gap-1.5">
                                                <View className={`h-2 w-2 rounded-full ${one.dot}`} />
                                                <Text className="font-sans-bold text-[11px] uppercase tracking-wide text-slate-500">
                                                    {one.label}
                                                </Text>
                                            </View>
                                            <Text className="font-sans-bold text-lg text-slate-900">
                                                {count} <Text className="font-sans text-sm text-slate-500">{count === 1 ? 'task' : 'tasks'}</Text>
                                            </Text>
                                            <Text numberOfLines={1} className="font-sans text-xs text-slate-500">
                                                {first ? first.title : 'Nothing else here.'}
                                            </Text>
                                        </View>
                                        <ChevronRight size={18} color="#94a3b8" />
                                    </Pressable>
                                );
                            })}
                        </View>
                    </>
                )}
            </ScrollView>

            {tasks && card && (
                <BottomSheet
                    open={openCard !== null}
                    onClose={() => setOpenCard(null)}
                    title={`${card.label} · ${tasks.order_cards[card.key].count}`}
                    subtitle={card.detail}
                    icon={<card.icon size={20} color={card.color} />}
                    footer={
                        <SheetFooter
                            onClose={() => setOpenCard(null)}
                            more={
                                tasks.order_cards[card.key].count > tasks.order_cards[card.key].orders.length
                                    ? {
                                          label: 'See all in Orders',
                                          onPress: () => {
                                              setOpenCard(null);
                                              router.navigate('/staff-orders');
                                          },
                                      }
                                    : null
                            }
                        />
                    }
                >
                    {tasks.order_cards[card.key].orders.length === 0 ? (
                        <Text className="font-sans text-sm text-slate-500">No orders here.</Text>
                    ) : (
                        <View className="gap-2.5">
                            {tasks.order_cards[card.key].orders.map((order) => (
                                <StaffOrderRow key={order.id} order={order} onOpen={() => setOpenCard(null)} />
                            ))}
                        </View>
                    )}
                </BottomSheet>
            )}

            {tasks && group && (
                <BottomSheet
                    open={openGroup !== null}
                    onClose={() => setOpenGroup(null)}
                    title={`${group.label} · ${countTasks(tasks[group.key])} ${countTasks(tasks[group.key]) === 1 ? 'task' : 'tasks'}`}
                    subtitle="Most urgent first."
                    icon={<group.icon size={20} color={group.color} />}
                    footer={<SheetFooter onClose={() => setOpenGroup(null)} more={null} />}
                >
                    {tasks[group.key].length === 0 ? (
                        <View className="flex-row items-center gap-2">
                            <CircleCheck size={18} color="#10b981" />
                            <Text className="font-sans text-sm text-slate-600">Nothing here. All done.</Text>
                        </View>
                    ) : (
                        <View className="gap-2.5">
                            {tasks[group.key].map((task) => (
                                <TaskCard key={task.key} task={task} onOpen={() => setOpenGroup(null)} />
                            ))}
                        </View>
                    )}
                </BottomSheet>
            )}
        </>
    );
}

function SectionTitle({ title, hint }: { title: string; hint: string }) {
    return (
        <View className="flex-row items-baseline justify-between gap-2 px-1">
            <Text className="font-sans-bold text-xs uppercase tracking-wide text-slate-700">{title}</Text>
            <Text className="font-sans text-xs text-slate-400">{hint}</Text>
        </View>
    );
}

function SheetFooter({
    onClose,
    more,
}: {
    onClose: () => void;
    more: { label: string; onPress: () => void } | null;
}) {
    return (
        <View className="flex-row gap-3">
            <Pressable
                onPress={onClose}
                accessibilityRole="button"
                className="flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white py-3.5"
            >
                <Text className="font-sans-bold text-base text-slate-700">Close</Text>
            </Pressable>
            {more && (
                <Pressable
                    onPress={more.onPress}
                    accessibilityRole="button"
                    className="flex-1 items-center justify-center rounded-2xl bg-brand py-3.5"
                >
                    <Text className="font-sans-bold text-base text-white">{more.label}</Text>
                </Pressable>
            )}
        </View>
    );
}

function TaskCard({ task, onOpen }: { task: SpecialistTask; onOpen: () => void }) {
    const look = taskLooks[task.kind] ?? taskLooks.more;
    const Icon = look.icon;

    return (
        <View className="flex-row gap-3 rounded-2xl border border-slate-200 bg-white p-3.5">
            <View className={`h-9 w-9 items-center justify-center rounded-xl ${look.box}`}>
                <Icon size={18} color={look.color} />
            </View>
            <View className="flex-1 gap-2">
                <View className="gap-0.5">
                    <Text className="font-sans-bold text-sm text-slate-900">{task.title}</Text>
                    {task.detail !== '' && (
                        <Text className="font-sans text-xs leading-5 text-slate-500">{task.detail}</Text>
                    )}
                </View>
                {task.target ? (
                    <Pressable
                        onPress={() => {
                            onOpen();
                            if (task.target) {
                                open(task.target);
                            }
                        }}
                        accessibilityRole="button"
                        className="flex-row items-center gap-1.5 self-start rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2"
                    >
                        <Text className="font-sans-bold text-sm text-blue-700">{openLabel(task.target)}</Text>
                        <ArrowRight size={15} color="#1d4ed8" />
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
        </View>
    );
}
