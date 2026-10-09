import { router, useLocalSearchParams } from 'expo-router';
import {
    ArrowLeft,
    CircleCheck,
    PackageCheck,
    ScanLine,
    SearchX,
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
import { formatDate, formatDateTime, formatPeso } from '@/lib/format';
import type { SlipLookup, SpecialistOrder } from '@/lib/types';

/**
 * A scanned issuance slip on the Specialist's phone, like the website's:
 * checks in V1's colors (green fine, red stop, amber look), the amount to
 * collect, and the next step: Ready for pickup, Release once the student
 * has paid (the items leave the shelf only then), Undo release the same
 * day, or Cancel. The slip itself is below. Not a PROWARE slip: says so.
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
                <View
                    style={{ borderLeftWidth: 5, borderLeftColor: '#ef4444' }}
                    className="items-center gap-2 rounded-3xl border border-slate-200 bg-white px-6 py-10"
                >
                    <SearchX size={40} color="#f87171" />
                    <Text className="font-sans-bold text-lg text-slate-900">Not a PROWARE slip</Text>
                    <Text className="text-center font-sans text-sm leading-5 text-slate-500">
                        No order has the code <Text className="font-sans-bold text-slate-700">{code}</Text>.
                        Scan the slip again, or type its order number (PW-0042). The student can also open
                        the slip from My Orders.
                    </Text>
                </View>
            ) : loadError && result === null ? (
                <Text className="font-sans-semibold text-sm text-red-600">{loadError}</Text>
            ) : result === null || order === undefined ? (
                <ActivityIndicator color="#0D6EFD" className="mt-10" />
            ) : (
                <>
                    <View className="flex-row items-start justify-between gap-3">
                        <View className="flex-1">
                            <Text className="font-sans-bold text-2xl text-slate-900">{order.number}</Text>
                            <Text className="font-sans-semibold text-base text-slate-800">
                                {order.student_name}
                                {order.student_section ? ` · ${order.student_section}` : ''}
                            </Text>
                        </View>
                        <OrderStatusPill order={order} />
                    </View>

                    <View className="gap-2">
                        <OrderStateCheck order={order} />
                        {isOpen && (
                            <Check tone="green">
                                Pick up by <Text className="font-sans-bold">{formatDate(order.pick_up_by)}</Text>.
                                Its items are held for it.
                            </Check>
                        )}
                        {result.other_open_orders.length > 0 && (
                            <Check tone="amber">
                                {order.student_name} has{' '}
                                {result.other_open_orders.length === 1
                                    ? 'another order'
                                    : `${result.other_open_orders.length} other orders`}{' '}
                                waiting.
                            </Check>
                        )}
                        {result.other_open_orders.length > 0 && (
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
                        )}
                    </View>

                    {isOpen && (
                        <View className="rounded-2xl bg-emerald-50 px-4 py-3">
                            <Text className="font-sans-bold text-xs uppercase tracking-wide text-emerald-800">
                                To collect
                            </Text>
                            <Text className="font-sans-bold text-3xl text-emerald-900">
                                {formatPeso(order.total_centavos)}
                            </Text>
                        </View>
                    )}

                    {done && (
                        <View className="flex-row items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                            <CircleCheck size={18} color="#047857" />
                            <Text className="flex-1 font-sans-semibold text-sm text-emerald-800">{done}</Text>
                        </View>
                    )}
                    {error && (
                        <View className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                            <Text className="font-sans-semibold text-sm text-red-700">{error}</Text>
                        </View>
                    )}

                    <View className="gap-3">
                        {order.status === 'placed' && (
                            <ActionButton
                                tone="blue"
                                icon={<PackageCheck size={18} color="#ffffff" />}
                                busy={busy}
                                onPress={() => void run('ready')}
                            >
                                Ready for pickup
                            </ActionButton>
                        )}
                        {isOpen && (
                            <ReleaseBox
                                order={order}
                                busy={busy}
                                onRelease={() => void run('release', { paid: true })}
                            />
                        )}
                        {order.can_undo_release && (
                            <ActionButton
                                tone="plain"
                                icon={<Undo2 size={18} color="#334155" />}
                                busy={busy}
                                onPress={() => void run('undo-release')}
                            >
                                Undo release
                            </ActionButton>
                        )}
                        {isOpen && (
                            <ActionButton
                                tone="red"
                                icon={<XCircle size={18} color="#b91c1c" />}
                                busy={busy}
                                onPress={() => setCancelling(true)}
                            >
                                Cancel order
                            </ActionButton>
                        )}
                    </View>

                    <IssuanceSlipCard slip={result.slip} showQr={false} />

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

            {(notFound || result !== null) && (
                <ActionButton
                    tone={notFound || !isOpen ? 'blue' : 'plain'}
                    icon={<ScanLine size={18} color={notFound || !isOpen ? '#ffffff' : '#334155'} />}
                    busy={busy}
                    onPress={scanNext}
                >
                    {notFound ? 'Scan again' : 'Scan the next slip'}
                </ActionButton>
            )}
        </ScrollView>
    );
}

/**
 * Green while the order can still be released; red when it was released
 * already (so the items are not handed over twice) or cancelled.
 */
function OrderStateCheck({ order }: { order: SpecialistOrder }) {
    switch (order.status) {
        case 'placed':
            return <Check tone="green">Not released yet. The office is preparing it.</Check>;
        case 'ready':
            return <Check tone="green">Not released yet. Ready for pickup.</Check>;
        case 'picked_up':
            return (
                <Check tone="red">
                    Already released {formatDateTime(order.picked_up_at)}
                    {order.handled_by ? ` by ${order.handled_by}` : ''}. Do not hand the items over again.
                </Check>
            );
        default:
            return (
                <Check tone="red">
                    {order.expired
                        ? `Expired: not released by ${formatDate(order.pick_up_by)}.`
                        : `Cancelled ${formatDateTime(order.cancelled_at)}.`}{' '}
                    This slip can no longer be used.
                    {!order.expired && order.cancel_reason ? ` ${order.cancel_reason}` : ''}
                </Check>
            );
    }
}

function Check({ tone, children }: { tone: 'green' | 'red' | 'amber'; children: ReactNode }) {
    const style = {
        green: { box: 'bg-emerald-50', text: 'text-emerald-900', icon: <CircleCheck size={16} color="#047857" /> },
        red: { box: 'bg-red-50', text: 'text-red-900', icon: <XCircle size={16} color="#b91c1c" /> },
        amber: { box: 'bg-amber-50', text: 'text-amber-900', icon: <TriangleAlert size={16} color="#b45309" /> },
    }[tone];

    return (
        <View className={`flex-row items-start gap-2 rounded-xl px-3 py-2.5 ${style.box}`}>
            <View className="mt-0.5">{style.icon}</View>
            <Text className={`flex-1 font-sans text-sm leading-5 ${style.text}`}>{children}</Text>
        </View>
    );
}
