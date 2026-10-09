import { router, useFocusEffect } from 'expo-router';
import {
    ArrowRight,
    Banknote,
    Bell,
    Boxes,
    CalendarClock,
    CircleCheck,
    Flame,
    Hourglass,
    Link2,
    Monitor,
    PackageCheck,
    ScanLine,
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

import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatPeso } from '@/lib/format';
import { useNotifications } from '@/lib/notifications';
import type { SpecialistTask, SpecialistTasks } from '@/lib/types';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Each kind of task's icon and V1 color, the same as the website dashboard:
 * blue in progress, amber waiting, red urgent, green good, grey quiet.
 */
const taskLooks: Record<string, { icon: LucideIcon; box: string; color: string }> = {
    order: { icon: PackageCheck, box: 'bg-blue-50', color: '#1d4ed8' },
    low_stock: { icon: TriangleAlert, box: 'bg-amber-50', color: '#b45309' },
    out_of_stock: { icon: TriangleAlert, box: 'bg-red-50', color: '#b91c1c' },
    split: { icon: Boxes, box: 'bg-emerald-50', color: '#047857' },
    link: { icon: Link2, box: 'bg-amber-50', color: '#b45309' },
    delivery: { icon: Truck, box: 'bg-blue-50', color: '#1d4ed8' },
    last_day: { icon: Hourglass, box: 'bg-red-50', color: '#b91c1c' },
    sale_ending: { icon: Flame, box: 'bg-red-50', color: '#dc2626' },
    preorders: { icon: CalendarClock, box: 'bg-amber-50', color: '#b45309' },
    slow_moving: { icon: Snail, box: 'bg-slate-100', color: '#475569' },
    more: { icon: ArrowRight, box: 'bg-slate-100', color: '#475569' },
};

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

/** Tasks in a group, not counting the "and N more" line. */
function countTasks(tasks: SpecialistTask[]): number {
    return tasks.filter((task) => task.kind !== 'more').length;
}

/**
 * The Specialist's To-do, the same list as the website dashboard: a
 * greeting with today's date, Scan issuance slip, four numbers (cash to
 * collect, collected today, Do now, Today), then Do now, Today and This
 * week, most urgent first. A task disappears by itself once it is done.
 * Desk work (linking items, sales) says to do it on the website.
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

    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const today = `${WEEKDAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`;

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

                <Pressable
                    onPress={() => router.push('/scan-slip')}
                    accessibilityRole="button"
                    className="flex-row items-center justify-center gap-2 rounded-2xl bg-white py-3.5"
                >
                    <ScanLine size={19} color="#0D6EFD" />
                    <Text className="font-sans-bold text-base text-brand">Scan issuance slip</Text>
                </Pressable>
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
                    <View className="gap-3">
                        <View className="flex-row gap-3">
                            <SummaryTile
                                icon={Banknote}
                                box="bg-amber-50"
                                color="#b45309"
                                label="To collect"
                                value={formatPeso(tasks.cash.waiting_centavos)}
                                detail={`${tasks.cash.waiting_orders} ready for pickup`}
                                onPress={() => router.navigate('/staff-orders')}
                            />
                            <SummaryTile
                                icon={CircleCheck}
                                box="bg-emerald-50"
                                color="#047857"
                                label="Collected today"
                                value={formatPeso(tasks.cash.collected_centavos)}
                                detail={`${tasks.cash.collected_orders} released`}
                                onPress={() => router.navigate('/staff-orders')}
                            />
                        </View>
                        <View className="flex-row gap-3">
                            <SummaryTile
                                icon={Flame}
                                box="bg-red-50"
                                color="#b91c1c"
                                label="Do now"
                                value={String(countTasks(tasks.now))}
                                detail={countTasks(tasks.now) === 1 ? 'task' : 'tasks'}
                            />
                            <SummaryTile
                                icon={CalendarClock}
                                box="bg-blue-50"
                                color="#1d4ed8"
                                label="Today"
                                value={String(countTasks(tasks.today))}
                                detail={countTasks(tasks.today) === 1 ? 'task' : 'tasks'}
                            />
                        </View>
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
                            <Section title="Do now" dot="bg-red-500" badge="bg-red-50" badgeText="text-red-700" tasks={tasks.now} />
                            <Section title="Today" dot="bg-amber-400" badge="bg-amber-50" badgeText="text-amber-700" tasks={tasks.today} />
                            <Section title="This week" dot="bg-blue-500" badge="bg-blue-50" badgeText="text-blue-700" tasks={tasks.week} />
                        </>
                    )}
                </>
            )}
        </ScrollView>
    );
}

function SummaryTile({
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
    onPress?: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            disabled={!onPress}
            accessibilityRole={onPress ? 'button' : undefined}
            className="flex-1 rounded-3xl border border-slate-200 bg-white p-4"
        >
            <View className={`h-10 w-10 items-center justify-center rounded-2xl ${box}`}>
                <Icon size={20} color={color} />
            </View>
            <Text className="mt-3 font-sans-bold text-[11px] uppercase tracking-wide text-slate-500">{label}</Text>
            <Text numberOfLines={1} className="font-sans-bold text-xl text-slate-900">
                {value}
            </Text>
            <Text numberOfLines={1} className="font-sans text-xs text-slate-500">
                {detail}
            </Text>
        </Pressable>
    );
}

/** One group; an empty one shrinks to a single line that says so. */
function Section({
    title,
    dot,
    badge,
    badgeText,
    tasks,
}: {
    title: string;
    dot: string;
    badge: string;
    badgeText: string;
    tasks: SpecialistTask[];
}) {
    if (tasks.length === 0) {
        return (
            <View className="flex-row items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <View className={`h-2.5 w-2.5 rounded-full ${dot}`} />
                <Text className="font-sans-bold text-xs uppercase tracking-wide text-slate-700">{title}</Text>
                <View className="ml-auto flex-row items-center gap-1.5">
                    <CircleCheck size={15} color="#10b981" />
                    <Text className="font-sans text-sm text-slate-500">Nothing here</Text>
                </View>
            </View>
        );
    }

    return (
        <View className="gap-2.5">
            <View className="flex-row items-center gap-2 px-1">
                <View className={`h-2.5 w-2.5 rounded-full ${dot}`} />
                <Text className="font-sans-bold text-xs uppercase tracking-wide text-slate-700">{title}</Text>
                <View className={`rounded-full px-2 py-0.5 ${badge}`}>
                    <Text className={`font-sans-bold text-[11px] ${badgeText}`}>{countTasks(tasks)}</Text>
                </View>
            </View>
            {tasks.map((task) => (
                <TaskCard key={task.key} task={task} />
            ))}
        </View>
    );
}

function TaskCard({ task }: { task: SpecialistTask }) {
    const look = taskLooks[task.kind] ?? taskLooks.more;
    const Icon = look.icon;

    return (
        <View className="flex-row gap-3 rounded-3xl border border-slate-200 bg-white p-4">
            <View className={`h-10 w-10 items-center justify-center rounded-2xl ${look.box}`}>
                <Icon size={19} color={look.color} />
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
                        onPress={() => task.target && open(task.target)}
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
