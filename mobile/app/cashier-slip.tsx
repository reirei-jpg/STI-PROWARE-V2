import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Banknote, CircleCheck, ScanLine, SearchX, ShieldAlert } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import IssuanceSlipCard from '@/components/IssuanceSlipCard';
import StaffTag from '@/components/StaffTag';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatPeso } from '@/lib/format';
import type { CashierLookup } from '@/lib/types';

/**
 * A slip the cashier scanned (or typed), like the website's Payments page:
 * first the answer (Collect ₱X, Already paid, or Do not collect), then the
 * amount, what is not charged (sold before the buyer paid), and Mark as paid
 * (asked first; a payment is final). After paying, Scan the next slip.
 */
export default function CashierSlipScreen() {
    const { code } = useLocalSearchParams<{ code: string }>();
    const insets = useSafeAreaInsets();
    const { request } = useAuth();
    const [result, setResult] = useState<CashierLookup | null>(null);
    const [notFound, setNotFound] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (): Promise<void> => {
        try {
            setResult(await request<CashierLookup>(`/cashier/slip?code=${encodeURIComponent(code)}`));
            setNotFound(false);
            setLoadError(null);
        } catch (caught) {
            if (caught instanceof ApiError && caught.status === 404) {
                setNotFound(true);
            } else {
                setLoadError(caught instanceof ApiError ? caught.message : 'The slip could not be loaded. Try again.');
            }
        }
    }, [code, request]);

    useEffect(() => {
        setResult(null);
        setDone(null);
        setError(null);
        void load();
    }, [load]);

    const scanNext = (): void => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/scan-slip');
        }
    };

    if (notFound) {
        return (
            <Screen insets={insets}>
                <View
                    style={{ borderLeftWidth: 5, borderLeftColor: '#ef4444' }}
                    className="items-center gap-2 rounded-3xl border border-slate-200 bg-white px-6 py-10"
                >
                    <SearchX size={40} color="#f87171" />
                    <Text className="font-sans-bold text-lg text-slate-900">Slip not found</Text>
                    <Text className="text-center font-sans text-sm leading-5 text-slate-500">
                        No PROWARE slip matches <Text className="font-sans-bold text-slate-700">{code}</Text>. Check the
                        number, or scan the QR again.
                    </Text>
                </View>
                <ScanButton main onPress={scanNext} label="Scan again" />
            </Screen>
        );
    }

    if (result === null) {
        return (
            <Screen insets={insets}>
                {loadError ? (
                    <Text className="font-sans-semibold text-sm text-red-600">{loadError}</Text>
                ) : (
                    <ActivityIndicator color="#0D6EFD" className="mt-10" />
                )}
            </Screen>
        );
    }

    const isOrder = result.kind === 'order';
    const number = isOrder ? result.order?.number : result.slip.number;
    const buyer = result.slip.student_name;
    const amount = result.to_collect_centavos ?? 0;
    const alreadyPaid = isOrder
        ? result.order?.status === 'paid' || result.order?.status === 'picked_up'
        : result.slip.status !== 'waiting_payment';

    const markPaid = async (): Promise<void> => {
        setBusy(true);
        setError(null);

        try {
            const answer = await request<{ message: string; result: CashierLookup | null }>(
                isOrder ? `/cashier/orders/${result.order?.id}/paid` : `/cashier/preorder-slips/${result.slip.slip_id}/paid`,
                { method: 'POST' },
            );
            setDone(answer.message);

            if (answer.result) {
                setResult(answer.result);
            }
        } catch (caught) {
            setError(caught instanceof ApiError ? caught.message : 'The payment could not be recorded. Try again.');
            await load();
        } finally {
            setBusy(false);
        }
    };

    const confirm = (): void =>
        Alert.alert(
            `Record the payment for ${number ?? ''}?`,
            `Confirm that ${buyer} has paid ${formatPeso(amount)}. ${
                isOrder
                    ? 'The items will be reserved for pickup at the PROWARE office.'
                    : 'The slip will be marked PAID, and the preorder can no longer be changed or cancelled.'
            } This action cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Mark as Paid', onPress: () => void markPaid() },
            ],
        );

    return (
        <Screen insets={insets}>
            {done ? (
                <View className="gap-3 rounded-3xl bg-emerald-600 p-5">
                    <View className="flex-row items-start gap-3">
                        <CircleCheck size={26} color="#ffffff" />
                        <Text className="flex-1 font-sans-bold text-base leading-6 text-white">{done}</Text>
                    </View>
                    <Pressable
                        onPress={scanNext}
                        accessibilityRole="button"
                        className="flex-row items-center justify-center gap-2 rounded-2xl bg-white py-3.5"
                    >
                        <ScanLine size={18} color="#047857" />
                        <Text className="font-sans-bold text-base text-emerald-700">Scan the next slip</Text>
                    </Pressable>
                </View>
            ) : (
                <View
                    className={`flex-row items-center gap-4 rounded-3xl p-5 ${result.can_mark_paid ? 'bg-amber-500' : alreadyPaid ? 'bg-emerald-600' : 'bg-red-600'}`}
                >
                    <View className="h-14 w-14 items-center justify-center rounded-2xl bg-white/20">
                        {result.can_mark_paid ? (
                            <Banknote size={30} color="#ffffff" />
                        ) : alreadyPaid ? (
                            <CircleCheck size={30} color="#ffffff" />
                        ) : (
                            <ShieldAlert size={30} color="#ffffff" />
                        )}
                    </View>
                    <View className="flex-1 gap-0.5">
                        <Text className="font-sans-bold text-lg uppercase tracking-wide text-white">
                            {result.can_mark_paid
                                ? `Amount due: ${formatPeso(amount)}`
                                : alreadyPaid
                                  ? 'Payment already recorded'
                                  : 'Payment cannot be accepted'}
                        </Text>
                        <Text className="font-sans text-sm leading-5 text-white/90">
                            {result.can_mark_paid
                                ? `${isOrder ? 'Order' : 'Preorder'} ${number} · ${buyer}. Collect this amount, then tap Mark as Paid.`
                                : result.refusal}
                        </Text>
                    </View>
                </View>
            )}

            {error && (
                <View className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                    <Text className="font-sans-semibold text-sm text-red-700">{error}</Text>
                </View>
            )}

            <View className="gap-1 rounded-3xl border border-slate-200 bg-white p-4">
                <View className="flex-row items-center gap-2">
                    <Text className="shrink font-sans-bold text-base text-slate-900">{buyer}</Text>
                    {result.slip.is_staff && <StaffTag />}
                </View>
                <Text className="font-sans text-sm text-slate-500">
                    {isOrder ? 'Order' : 'Preorder'} <Text className="font-sans-bold text-slate-700">{number}</Text>
                </Text>
            </View>

            {result.can_mark_paid && !done && (
                <>
                    <View className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                        <Text className="font-sans-bold text-xs uppercase tracking-wide text-amber-800">Amount due</Text>
                        <Text className="font-sans-bold text-3xl text-slate-900">{formatPeso(amount)}</Text>
                    </View>
                    {result.short.length > 0 && (
                        <Text className="rounded-xl bg-amber-50 px-3 py-2 font-sans-semibold text-sm leading-5 text-amber-900">
                            Not charged (sold out before payment): {result.short.join(', ')}.
                        </Text>
                    )}
                    <Pressable
                        onPress={confirm}
                        disabled={busy}
                        accessibilityRole="button"
                        className={`flex-row items-center justify-center gap-2 rounded-2xl bg-brand py-4 ${busy ? 'opacity-60' : ''}`}
                    >
                        {busy ? <ActivityIndicator color="#ffffff" /> : <Banknote size={18} color="#ffffff" />}
                        <Text className="font-sans-bold text-base text-white">Mark as Paid · {formatPeso(amount)}</Text>
                    </Pressable>
                </>
            )}

            <IssuanceSlipCard
                slip={
                    isOrder
                        ? { ...result.slip, status: result.order?.status ?? 'placed' }
                        : {
                              ...result.slip,
                              order_id: result.slip.slip_id ?? 0,
                              status: result.slip.status === 'released' ? 'picked_up' : 'placed',
                              pick_up_by: null,
                              released_on: null,
                              issued_by: null,
                          }
                }
                title={isOrder ? undefined : 'PREORDER SLIP'}
                paid={!isOrder && result.slip.status === 'paid'}
                showQr={false}
            />

            {!done && !result.can_mark_paid && <ScanButton main onPress={scanNext} label="Scan the next slip" />}
        </Screen>
    );
}

function Screen({ insets, children }: { insets: { top: number; bottom: number }; children: React.ReactNode }) {
    return (
        <ScrollView
            className="flex-1 bg-page"
            contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32, paddingHorizontal: 16, gap: 16 }}
        >
            <Pressable
                onPress={() => router.back()}
                accessibilityRole="button"
                className="flex-row items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
                <ArrowLeft size={17} color="#334155" />
                <Text className="font-sans-bold text-sm text-slate-700">Back</Text>
            </Pressable>
            {children}
        </ScrollView>
    );
}

function ScanButton({ main, onPress, label }: { main: boolean; onPress: () => void; label: string }) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            className={`flex-row items-center justify-center gap-2 rounded-2xl py-4 ${main ? 'bg-brand' : 'border border-slate-200 bg-white'}`}
        >
            <ScanLine size={18} color={main ? '#ffffff' : '#334155'} />
            <Text className={`font-sans-bold text-base ${main ? 'text-white' : 'text-slate-700'}`}>{label}</Text>
        </Pressable>
    );
}
