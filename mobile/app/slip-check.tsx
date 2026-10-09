import { router, useLocalSearchParams } from 'expo-router';
import {
    ArrowLeft,
    Ban,
    CircleCheck,
    PackageCheck,
    ScanLine,
    SearchX,
    ShieldAlert,
    TriangleAlert,
    Undo2,
    XCircle,
} from 'lucide-react-native';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import IssuanceSlipCard from '@/components/IssuanceSlipCard';
import OrderStatusPill from '@/components/OrderStatusPill';
import { ActionButton, CancelSheet, ReleaseBox } from '@/components/StaffOrderActions';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatDateTime } from '@/lib/format';
import type { SlipLookup, SpecialistOrder } from '@/lib/types';

/**
 * A scanned issuance slip on the Specialist's phone, like the website's:
 * first a large banner that answers "can I release this?" (green OK, red
 * stop), then the student, the checks, and the release as numbered steps
 * (collect, tick paid, release: the items leave the shelf only then).
 * Ready for pickup, Undo release (same day) and Cancel sit below, smaller.
 * After a step, Scan the next slip is the main button. Not a PROWARE slip:
 * says so.
 */
export default function SlipCheckScreen() {
    const { code } = useLocalSearchParams<{ code: string }>();
    const insets = useSafeAreaInsets();
    const { request } = useAuth();
    const [result, setResult] = useState<SlipLookup | null>(null);
    const [notFound, setNotFound] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [cancelling, setCancelling] = useState(false);

    const load = useCallback(async (): Promise<void> => {
        try {
            setResult(await request<SlipLookup>(`/specialist/slips/${encodeURIComponent(code)}`));
            setNotFound(false);
            setLoadError(null);
        } catch (caught) {
            if (caught instanceof ApiError && caught.status === 404) {
                setNotFound(true);
            } else {
                setLoadError(
                    caught instanceof ApiError ? caught.message : 'The slip could not be loaded. Please try again.',
                );
            }
        }
    }, [code, request]);

    useEffect(() => {
        setResult(null);
        setDone(null);
        setError(null);
        void load();
    }, [load]);

    const run = async (path: string, body?: Record<string, unknown>): Promise<boolean> => {
        if (!result) {
            return false;
        }

        setBusy(true);
        setError(null);
        setDone(null);

        try {
            const answer = await request<{ message: string; order: SpecialistOrder }>(
                `/specialist/orders/${result.order.id}/${path}`,
                { method: 'POST', body },
            );

            setDone(answer.message);

            return true;
        } catch (caught) {
            setError(caught instanceof ApiError ? caught.message : 'It could not be done. Please try again.');

            return false;
        } finally {
            // The slip shows RELEASED (or what changed on the website meanwhile).
            await load();
            setBusy(false);
        }
    };

    const scanNext = (): void => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/scan-slip');
        }
    };

    const order = result?.order;
    const isOpen = order?.status === 'placed' || order?.status === 'ready';

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

            {notFound ? (
                <>
                    <View
                        style={{ borderLeftWidth: 5, borderLeftColor: '#ef4444' }}
                        className="items-center gap-2 rounded-3xl border border-slate-200 bg-white px-6 py-10"
                    >
                        <SearchX size={40} color="#f87171" />
                        <Text className="font-sans-bold text-lg text-slate-900">Not a PROWARE slip</Text>
                        <Text className="text-center font-sans text-sm leading-5 text-slate-500">
                            No order has the code{' '}
                            <Text className="font-sans-bold text-slate-700">{code}</Text>. Scan the slip
                            again, or type its order number (PW-0042). The student can also open the slip
                            from My Orders.
                        </Text>
                    </View>
                    <ScanNextButton main onPress={scanNext}>
                        Scan again
                    </ScanNextButton>
                </>
            ) : loadError && result === null ? (
                <Text className="font-sans-semibold text-sm text-red-600">{loadError}</Text>
            ) : result === null || order === undefined ? (
                <ActivityIndicator color="#0D6EFD" className="mt-10" />
            ) : (
                <>
                    {done ? (
                        <View className="gap-3 rounded-3xl bg-emerald-600 p-5">
                            <View className="flex-row items-start gap-3">
                                <CircleCheck size={26} color="#ffffff" />
                                <Text className="flex-1 font-sans-bold text-base leading-6 text-white">
                                    {done}
                                </Text>
                            </View>
                            <Pressable
                                onPress={scanNext}
                                accessibilityRole="button"
                                className="flex-row items-center justify-center gap-2 rounded-2xl bg-white py-3.5"
                            >
                                <ScanLine size={18} color="#047857" />
                                <Text className="font-sans-bold text-base text-emerald-700">
                                    Scan the next slip
                                </Text>
                            </Pressable>
                        </View>
                    ) : (
                        <ReleaseVerdict order={order} />
                    )}

                    {error && (
                        <View className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                            <Text className="font-sans-semibold text-sm text-red-700">{error}</Text>
                        </View>
                    )}

                    <View className="flex-row items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4">
                        <View className="h-12 w-12 items-center justify-center rounded-full border border-blue-200 bg-blue-50">
                            <Text className="font-sans-bold text-base text-blue-700">
                                {initials(order.student_name)}
                            </Text>
                        </View>
                        <View className="flex-1">
                            <Text numberOfLines={1} className="font-sans-bold text-base text-slate-900">
                                {order.student_name}
                            </Text>
                            <Text className="font-sans text-sm text-slate-500">
                                <Text className="font-sans-bold text-slate-700">{order.number}</Text>
                                {order.student_section ? ` · ${order.student_section}` : ''}
                            </Text>
                        </View>
                        <OrderStatusPill order={order} />
                    </View>

                    {(isOpen || result.other_open_orders.length > 0) && (
                        <View className="gap-2">
                            {isOpen && (
                                <Check tone="green">
                                    Pick up by{' '}
                                    <Text className="font-sans-bold">{formatDate(order.pick_up_by)}</Text>. Its
                                    items are held for it.
                                </Check>
                            )}
                            {result.other_open_orders.length > 0 && (
                                <>
                                    <Check tone="amber">
                                        {order.student_name} has{' '}
                                        {result.other_open_orders.length === 1
                                            ? 'another order'
                                            : `${result.other_open_orders.length} other orders`}{' '}
                                        waiting.
                                    </Check>
                                    <View className="flex-row flex-wrap gap-2">
                                        {result.other_open_orders.map((other) => (
                                            <Pressable
                                                key={other.id}
                                                onPress={() => router.setParams({ code: other.number ?? '' })}
                                                accessibilityRole="button"
                                                className="rounded-xl border border-amber-300 bg-white px-3 py-2"
                                            >
                                                <Text className="font-sans-bold text-sm text-amber-800">
                                                    Open {other.number} ({other.status_label})
                                                </Text>
                                            </Pressable>
                                        ))}
                                    </View>
                                </>
                            )}
                        </View>
                    )}

                    {isOpen && (
                        <ReleaseBox
                            order={order}
                            busy={busy}
                            onRelease={() => void run('release', { paid: true })}
                        />
                    )}

                    {(order.status === 'placed' || order.can_undo_release || isOpen) && (
                        <View className="flex-row flex-wrap gap-2">
                            {order.status === 'placed' && (
                                <View className="min-w-36 flex-1">
                                    <ActionButton
                                        small
                                        tone="plain"
                                        icon={<PackageCheck size={16} color="#1d4ed8" />}
                                        busy={busy}
                                        onPress={() => void run('ready')}
                                    >
                                        Ready for pickup
                                    </ActionButton>
                                </View>
                            )}
                            {order.can_undo_release && (
                                <View className="min-w-36 flex-1">
                                    <ActionButton
                                        small
                                        tone="plain"
                                        icon={<Undo2 size={16} color="#334155" />}
                                        busy={busy}
                                        onPress={() => void run('undo-release')}
                                    >
                                        Undo release
                                    </ActionButton>
                                </View>
                            )}
                            {isOpen && (
                                <View className="min-w-36 flex-1">
                                    <ActionButton
                                        small
                                        tone="red"
                                        icon={<XCircle size={16} color="#b91c1c" />}
                                        busy={busy}
                                        onPress={() => setCancelling(true)}
                                    >
                                        Cancel order
                                    </ActionButton>
                                </View>
                            )}
                        </View>
                    )}

                    <IssuanceSlipCard slip={result.slip} showQr={false} />

                    {!done && (
                        <ScanNextButton main={!isOpen} onPress={scanNext}>
                            Scan the next slip
                        </ScanNextButton>
                    )}

                    <CancelSheet
                        order={order}
                        open={cancelling}
                        onClose={() => setCancelling(false)}
                        onCancel={async (reason) => {
                            if (await run('cancel', { reason })) {
                                setCancelling(false);
                            }
                        }}
                        busy={busy}
                        error={error}
                    />
                </>
            )}
        </ScrollView>
    );
}

/** "Juan Dela Cruz" -> "JC". */
function initials(name: string): string {
    const words = name.trim().split(/\s+/);

    return `${words[0]?.[0] ?? ''}${words.length > 1 ? (words[words.length - 1][0] ?? '') : ''}`.toUpperCase();
}

/**
 * The answer first, in V1's colors: green while the items can still be
 * released, red when they were released already (so they are not handed
 * over twice) or the order was cancelled or expired.
 */
function ReleaseVerdict({ order }: { order: SpecialistOrder }) {
    const ok = order.status === 'placed' || order.status === 'ready';
    const title = ok
        ? 'OK to release'
        : order.status === 'picked_up'
          ? 'Do not release: already released'
          : order.expired
            ? 'Do not release: expired'
            : 'Do not release: cancelled';
    const text =
        order.status === 'ready'
            ? 'Ready for pickup and not released yet.'
            : order.status === 'placed'
              ? 'Not released yet. The office is still preparing it.'
              : order.status === 'picked_up'
                ? `Released ${formatDateTime(order.picked_up_at)}${order.handled_by ? ` by ${order.handled_by}` : ''}. Do not hand the items over again.`
                : `${order.expired ? `Not released by ${formatDate(order.pick_up_by)}.` : `Cancelled ${formatDateTime(order.cancelled_at)}.`} This slip can no longer be used.${!order.expired && order.cancel_reason ? ` ${order.cancel_reason}` : ''}`;

    return (
        <View className={`flex-row items-center gap-4 rounded-3xl p-5 ${ok ? 'bg-emerald-600' : 'bg-red-600'}`}>
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-white/20">
                {ok ? (
                    <CircleCheck size={30} color="#ffffff" />
                ) : order.status === 'picked_up' ? (
                    <ShieldAlert size={30} color="#ffffff" />
                ) : (
                    <Ban size={30} color="#ffffff" />
                )}
            </View>
            <View className="flex-1 gap-0.5">
                <Text className="font-sans-bold text-lg uppercase tracking-wide text-white">{title}</Text>
                <Text className="font-sans text-sm leading-5 text-white/90">{text}</Text>
            </View>
        </View>
    );
}

function ScanNextButton({ main, onPress, children }: { main: boolean; onPress: () => void; children: string }) {
    return (
        <ActionButton
            tone={main ? 'blue' : 'plain'}
            icon={<ScanLine size={18} color={main ? '#ffffff' : '#334155'} />}
            busy={false}
            onPress={onPress}
        >
            {children}
        </ActionButton>
    );
}

function Check({ tone, children }: { tone: 'green' | 'amber'; children: ReactNode }) {
    const style = {
        green: { box: 'bg-emerald-50', text: 'text-emerald-900', icon: <CircleCheck size={16} color="#047857" /> },
        amber: { box: 'bg-amber-50', text: 'text-amber-900', icon: <TriangleAlert size={16} color="#b45309" /> },
    }[tone];

    return (
        <View className={`flex-row items-start gap-2 rounded-xl px-3 py-2.5 ${style.box}`}>
            <View className="mt-0.5">{style.icon}</View>
            <Text className={`flex-1 font-sans text-sm leading-5 ${style.text}`}>{children}</Text>
        </View>
    );
}
