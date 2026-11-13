import { router, useLocalSearchParams } from 'expo-router';
import {
    ArrowLeft,
    Ban,
    CircleCheck,
    ScanLine,
    SearchX,
    ShieldAlert,
    TriangleAlert,
} from 'lucide-react-native';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import IssuanceSlipCard from '@/components/IssuanceSlipCard';
import OrderStatusPill from '@/components/OrderStatusPill';
import { ActionButton, ReleaseBox } from '@/components/StaffOrderActions';
import StaffTag from '@/components/StaffTag';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLiveReload } from '@/lib/use-live-reload';
import { formatDate, formatDateTime, formatPeso, formatUnits } from '@/lib/format';
import type { PreorderSlipData, SlipLookup, SpecialistOrder } from '@/lib/types';

/** A scanned preorder slip (PR-0001), paid at the cashier. */
type PreorderLookup = {
    kind: 'preorder';
    slip: PreorderSlipData;
    can_mark_paid: boolean;
    refusal: string | null;
    /** Paid, and pieces arrived and are set aside: they can be released. */
    can_release: boolean;
    release_refusal: string | null;
    ready: { item: string; pieces: number }[];
};

/**
 * A scanned issuance slip on the Specialist's phone, like the website's:
 * first a large banner that answers "can I release this?" (green OK, red
 * stop), then the student, the checks, and the release as numbered steps
 * (collect, tick paid, release: the items leave the shelf only then).
 * A release is final, and items already sold to buyers who paid first are
 * released short. Only the buyer can cancel an order.
 * After a step, Scan the next slip is the main button. Not a PROWARE slip:
 * says so.
 */
export default function SlipCheckScreen() {
    const { code } = useLocalSearchParams<{ code: string }>();
    const insets = useSafeAreaInsets();
    const { request } = useAuth();
    const [result, setResult] = useState<SlipLookup | null>(null);
    const [preorder, setPreorder] = useState<PreorderLookup | null>(null);
    const [notFound, setNotFound] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (): Promise<void> => {
        try {
            const answer = await request<SlipLookup | PreorderLookup>(`/specialist/slips/${encodeURIComponent(code)}`);

            if ('kind' in answer && answer.kind === 'preorder') {
                setPreorder(answer);
                setResult(null);
            } else {
                setResult(answer as SlipLookup);
                setPreorder(null);
            }
            setNotFound(false);
            setLoadError(null);
        } catch (caught) {
            if (caught instanceof ApiError && caught.status === 404) {
                setNotFound(true);
            } else {
                setLoadError(
                    caught instanceof ApiError ? caught.message : 'The slip could not be loaded. Try again.',
                );
            }
        }
    }, [code, request]);

    useEffect(() => {
        setResult(null);
        setPreorder(null);
        setDone(null);
        setError(null);
        void load();
    }, [load]);

    // Up to date by itself while the order is open: once it is released,
    // cancelled or expires elsewhere, Release and Cancel go away.
    useLiveReload(load, result?.order.status === 'placed' && !busy);

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
            setError(caught instanceof ApiError ? caught.message : 'It could not be done. Try again.');

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
    const isOpen = order?.status === 'placed';

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
                            No order or preorder has the code{' '}
                            <Text className="font-sans-bold text-slate-700">{code}</Text>. Scan the slip
                            again, or type its number (PW-0042, or PR-0007 for a preorder). The buyer can also open the slip
                            from My Orders.
                        </Text>
                    </View>
                    <ScanNextButton main onPress={scanNext}>
                        Scan again
                    </ScanNextButton>
                </>
            ) : preorder ? (
                <PreorderPayment lookup={preorder} onChanged={load} onScanNext={scanNext} />
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
                            <View className="flex-row items-center gap-2">
                                <Text numberOfLines={1} className="shrink font-sans-bold text-base text-slate-900">
                                    {order.student_name}
                                </Text>
                                {order.is_staff && <StaffTag />}
                            </View>
                            <Text className="font-sans text-sm text-slate-500">
                                <Text className="font-sans-bold text-slate-700">{order.number}</Text>
                                {order.student_id ? ` · ID ${order.student_id}` : ''}
                                {order.student_section ? ` · ${order.student_section}` : ''}
                            </Text>
                        </View>
                        <OrderStatusPill order={order} />
                    </View>

                    {(isOpen || result.other_open_orders.length > 0) && (
                        <View className="gap-2">
                            {isOpen && (
                                <Check tone="amber">
                                    Nothing is set aside for this order: whoever pays first gets the items.
                                    Items already sold are released short.
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

                    <IssuanceSlipCard slip={result.slip} showQr={false} />

                    {!done && (
                        <ScanNextButton main={!isOpen} onPress={scanNext}>
                            Scan the next slip
                        </ScanNextButton>
                    )}

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
    const ok = order.status === 'placed';
    const title = ok
        ? 'OK to release'
        : order.status === 'picked_up'
          ? 'Do not release: already released'
          : order.expired
            ? 'Do not release: expired'
            : 'Do not release: cancelled';
    const text =
        order.status === 'placed'
            ? 'Not released yet. Check the cashier receipt, then release what is in stock.'
            : order.status === 'picked_up'
              ? `Released ${formatDateTime(order.picked_up_at)}${order.handled_by ? ` by ${order.handled_by}` : ''}. Do not hand the items over again.`
              : `${order.expired ? `Not released by ${order.pick_up_by ? formatDate(order.pick_up_by) : 'its pick-up date'}.` : `Cancelled ${formatDateTime(order.cancelled_at)}.`} This slip can no longer be used.${!order.expired && order.cancel_reason ? ` ${order.cancel_reason}` : ''}`;

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

/**
 * A scanned preorder slip: what to collect at the cashier, then Mark as
 * paid (asked first: a payment is final, the preorder can no longer be
 * changed or cancelled, and there is no refund). Once paid the slip says
 * PAID.
 */
function PreorderPayment({
    lookup,
    onChanged,
    onScanNext,
}: {
    lookup: PreorderLookup;
    onChanged: () => Promise<void>;
    onScanNext: () => void;
}) {
    const { request } = useAuth();
    const { slip } = lookup;
    const paid = slip.status === 'paid';
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const markPaid = async (): Promise<void> => {
        setBusy(true);
        setError(null);

        try {
            const answer = await request<{ message: string }>(`/specialist/preorder-slips/${slip.slip_id}/paid`, { method: 'POST' });
            setDone(answer.message);
        } catch (caught) {
            setError(caught instanceof ApiError ? caught.message : 'It could not be marked as paid. Try again.');
        } finally {
            await onChanged();
            setBusy(false);
        }
    };

    const readyPieces = lookup.ready.reduce((sum, line) => sum + line.pieces, 0);

    const release = async (): Promise<void> => {
        setBusy(true);
        setError(null);

        try {
            const answer = await request<{ message: string }>(`/specialist/preorder-slips/${slip.slip_id}/release`, { method: 'POST' });
            setDone(answer.message);
        } catch (caught) {
            setError(caught instanceof ApiError ? caught.message : 'It could not be released. Try again.');
        } finally {
            await onChanged();
            setBusy(false);
        }
    };

    const confirmRelease = (): void => {
        Alert.alert(
            `Release ${formatUnits(readyPieces, 'Piece')} to ${slip.student_name}?`,
            `${lookup.ready.map((line) => `${formatUnits(line.pieces, 'Piece')} of ${line.item}`).join(', ')}, already paid. They leave the shelf. This cannot be undone.`,
            [
                { text: 'Not yet', style: 'cancel' },
                { text: 'Release', onPress: () => void release() },
            ],
        );
    };

    const confirm = (): void => {
        Alert.alert(
            `Mark ${slip.number} as paid?`,
            `${slip.student_name} paid ${formatPeso(slip.total_centavos)} for ${slip.product_name}. The slip will say PAID, and the preorder can no longer be changed or cancelled. This cannot be undone.`,
            [
                { text: 'Not yet', style: 'cancel' },
                { text: 'Mark as paid', onPress: () => void markPaid() },
            ],
        );
    };

    return (
        <>
            {done ? (
                <View className="gap-3 rounded-3xl bg-emerald-600 p-5">
                    <View className="flex-row items-start gap-3">
                        <CircleCheck size={26} color="#ffffff" />
                        <Text className="flex-1 font-sans-bold text-base leading-6 text-white">{done}</Text>
                    </View>
                    <Pressable
                        onPress={onScanNext}
                        accessibilityRole="button"
                        className="flex-row items-center justify-center gap-2 rounded-2xl bg-white py-3.5"
                    >
                        <ScanLine size={18} color="#047857" />
                        <Text className="font-sans-bold text-base text-emerald-700">Scan the next slip</Text>
                    </Pressable>
                </View>
            ) : (
                <View
                    className={`flex-row items-start gap-3 rounded-3xl p-5 ${paid ? 'bg-emerald-600' : lookup.can_mark_paid ? 'bg-amber-500' : 'bg-red-600'}`}
                >
                    {paid ? (
                        <CircleCheck size={26} color="#ffffff" />
                    ) : lookup.can_mark_paid ? (
                        <TriangleAlert size={26} color="#ffffff" />
                    ) : (
                        <ShieldAlert size={26} color="#ffffff" />
                    )}
                    <View className="flex-1">
                        <Text className="font-sans-bold text-lg text-white">
                            {paid && lookup.can_release
                                ? `Preorder ${slip.number}: ready to release`
                                : paid
                                ? `Preorder ${slip.number} is paid`
                                : lookup.can_mark_paid
                                  ? `Preorder ${slip.number}: waiting for payment`
                                  : `Preorder ${slip.number} cannot be paid`}
                        </Text>
                        <Text className="font-sans text-sm leading-5 text-white">
                            {paid
                                ? lookup.can_release
                                    ? `${formatUnits(readyPieces, 'Piece')} arrived and ${readyPieces === 1 ? 'is' : 'are'} set aside for ${slip.student_name}, already paid. Hand ${readyPieces === 1 ? 'it' : 'them'} over, then release.`
                                    : lookup.release_refusal
                                : !lookup.can_mark_paid
                                ? lookup.refusal
                                : `${slip.student_name} pays ${formatPeso(slip.total_centavos)} for ${slip.product_name}. Check the cashier receipt, then mark it paid.`}
                        </Text>
                    </View>
                </View>
            )}

            {error && (
                <View className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                    <Text className="font-sans-semibold text-sm text-red-700">{error}</Text>
                </View>
            )}

            {lookup.can_release && !done && (
                <Pressable
                    onPress={confirmRelease}
                    disabled={busy}
                    accessibilityRole="button"
                    className={`flex-row items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 ${busy ? 'opacity-60' : ''}`}
                >
                    {busy && <ActivityIndicator size="small" color="#ffffff" />}
                    <Text className="font-sans-bold text-base text-white">Release {formatUnits(readyPieces, 'Piece')}</Text>
                </Pressable>
            )}

            {lookup.can_mark_paid && !done && (
                <Pressable
                    onPress={confirm}
                    disabled={busy}
                    accessibilityRole="button"
                    className={`flex-row items-center justify-center gap-2 rounded-2xl bg-brand py-4 ${busy ? 'opacity-60' : ''}`}
                >
                    {busy && <ActivityIndicator size="small" color="#ffffff" />}
                    <Text className="font-sans-bold text-base text-white">
                        Mark as paid · {formatPeso(slip.total_centavos)}
                    </Text>
                </Pressable>
            )}

            <IssuanceSlipCard
                slip={{ ...slip, order_id: slip.slip_id, status: 'placed', pick_up_by: null, released_on: null, issued_by: null }}
                title="PREORDER SLIP"
                paid={paid}
                showQr={false}
            />
        </>
    );
}
