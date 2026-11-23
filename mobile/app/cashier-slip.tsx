import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Banknote, CircleCheck, ReceiptText, ScanLine, SearchX, ShieldAlert, Smartphone, Undo2 } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BottomSheet from '@/components/BottomSheet';
import PaymentTicket from '@/components/PaymentTicket';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatPeso } from '@/lib/format';
import type { CashierLookup, PaymentReceipt } from '@/lib/types';

/** Up to ₱100,000.00, as the server allows. */
const MAX_RECEIVED_CENTAVOS = 10_000_000;

/** "500", "500.5", "₱1,250.00" → centavos; null when it is not an amount with up to 2 decimals. */
function toCentavos(typed: string): number | null {
    const clean = typed.replace(/[₱,\s]/g, '');

    return /^\d+(\.\d{1,2})?$/.test(clean) ? Math.round(Number(clean) * 100) : null;
}

/**
 * A slip the cashier scanned (or typed), like the website's Record Payment:
 * first the answer (Amount due, Payment already recorded, or Payment cannot
 * be accepted), then the amount, what is not charged (sold before the buyer
 * paid), the payment method (Cash with the amount received and the change,
 * or GCash with its 13-digit reference) and Mark as Paid (asked first). The
 * Payment Receipt opens next. A payment recorded by mistake can be undone
 * the same day, before release, with a reason.
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
    const [method, setMethod] = useState<'' | 'cash' | 'gcash'>('');
    const [received, setReceived] = useState('');
    const [reference, setReference] = useState('');
    const [fieldError, setFieldError] = useState<string | null>(null);

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
                        number or scan the QR code again.
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
        : (result.slip.status === 'paid' || result.slip.status === 'released');

    // What the cashier entered, checked as it is typed (the server checks it again).
    const receivedCentavos = toCentavos(received);
    const digits = reference.replace(/[\s-]/g, '');
    const cashProblem =
        method !== 'cash' || received.trim() === ''
            ? null
            : receivedCentavos === null
              ? 'Enter the amount received as a number with up to 2 decimal places, e.g. 500 or 500.50.'
              : receivedCentavos === 0
                ? 'The amount received must be more than ₱0.00.'
                : receivedCentavos > MAX_RECEIVED_CENTAVOS
                  ? 'The amount received cannot be more than ₱100,000.00.'
                  : receivedCentavos < amount
                    ? `The amount received (${formatPeso(receivedCentavos)}) is less than the amount due (${formatPeso(amount)}).`
                    : null;
    const gcashProblem =
        method !== 'gcash' || digits === '' || /^\d{13}$/.test(digits) ? null : 'The GCash reference number must be exactly 13 digits.';
    const ready =
        (method === 'cash' && receivedCentavos !== null && cashProblem === null) || (method === 'gcash' && /^\d{13}$/.test(digits));
    const change = receivedCentavos === null ? null : receivedCentavos - amount;

    const markPaid = async (): Promise<void> => {
        setBusy(true);
        setError(null);
        setFieldError(null);

        try {
            const answer = await request<{ message: string; result: CashierLookup | null; receipt: PaymentReceipt | null }>(
                isOrder ? `/cashier/orders/${result.order?.id}/paid` : `/cashier/preorder-slips/${result.slip.slip_id}/paid`,
                {
                    method: 'POST',
                    body: method === 'cash' ? { method: 'cash', amount_received: received.trim() } : { method: 'gcash', gcash_reference: digits },
                },
            );

            if (answer.receipt) {
                router.replace({ pathname: '/cashier-receipt/[id]', params: { id: String(answer.receipt.row.id), done: answer.message } });
            } else {
                setDone(answer.message);
            }
        } catch (caught) {
            const message = caught instanceof ApiError ? caught.message : 'The payment could not be recorded. Try again.';

            // A short amount or a used GCash reference belongs under its field.
            if (caught instanceof ApiError && caught.status === 422 && /amount received|GCash reference/i.test(message)) {
                setFieldError(message);
            } else {
                setError(message);
                await load();
            }
        } finally {
            setBusy(false);
        }
    };

    const confirm = (): void =>
        Alert.alert(
            `Record the payment for ${number ?? ''}?`,
            `${buyer} pays ${formatPeso(amount)} by ${
                method === 'cash' ? `cash: ${formatPeso(receivedCentavos)} received, ${formatPeso(change)} change` : `GCash, reference ${digits}`
            }. ${
                isOrder
                    ? 'The items will be reserved for pickup at the PROWARE office.'
                    : 'The slip will be marked PAID, and the preorder can no longer be changed or cancelled.'
            } A Payment Receipt is issued. If it is recorded by mistake, it can be undone today with a reason.`,
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
                                ? `${isOrder ? 'Order' : 'Preorder'} ${number} · ${buyer}. Collect this amount, choose the payment method, then tap Mark as Paid.`
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

            {/* A small order ticket, like at a fast-food counter: the full issuance slip is not needed to take a payment. */}
            <PaymentTicket
                kind={result.kind}
                number={number ?? null}
                date={result.slip.date}
                buyerName={buyer}
                buyerId={result.slip.student_id}
                section={result.slip.section}
                isStaff={result.slip.is_staff}
                items={result.slip.items}
                totalCentavos={result.slip.total_centavos}
                amountDueCentavos={result.can_mark_paid ? amount : null}
                paid={alreadyPaid}
            />

            {result.can_mark_paid && !done && (
                <View className="gap-3 rounded-3xl border border-slate-200 bg-white p-4">
                    <View className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                        <Text className="font-sans-bold text-xs uppercase tracking-wide text-amber-800">Amount due</Text>
                        <Text className="font-sans-bold text-3xl text-slate-900">{formatPeso(amount)}</Text>
                    </View>
                    {result.short.length > 0 && (
                        <Text className="rounded-xl bg-amber-50 px-3 py-2 font-sans-semibold text-sm leading-5 text-amber-900">
                            Not charged (sold out before payment): {result.short.join(', ')}.
                        </Text>
                    )}

                    <Text className="font-sans-bold text-sm text-slate-700">
                        Payment method <Text className="text-red-600">*</Text>
                    </Text>
                    <View className="flex-row gap-2">
                        {(
                            [
                                ['cash', 'Cash', Banknote],
                                ['gcash', 'GCash', Smartphone],
                            ] as const
                        ).map(([value, label, Icon]) => (
                            <Pressable
                                key={value}
                                onPress={() => {
                                    setMethod(value);
                                    setFieldError(null);
                                }}
                                accessibilityRole="radio"
                                accessibilityState={{ selected: method === value }}
                                className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl border py-3 ${method === value ? 'border-brand bg-brand' : 'border-slate-200 bg-white'}`}
                            >
                                <Icon size={17} color={method === value ? '#ffffff' : '#334155'} />
                                <Text className={`font-sans-bold text-sm ${method === value ? 'text-white' : 'text-slate-700'}`}>{label}</Text>
                            </Pressable>
                        ))}
                    </View>

                    {method === 'cash' && (
                        <View className="gap-1.5">
                            <View className="flex-row flex-wrap items-center justify-between gap-2">
                                <Text className="font-sans-bold text-sm text-slate-700">
                                    Amount received <Text className="text-red-600">*</Text>
                                </Text>
                                {/* The buyer handed over exactly the amount due: no typing, no change. */}
                                <Pressable
                                    onPress={() => {
                                        setReceived((amount / 100).toFixed(2));
                                        setFieldError(null);
                                    }}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Exact amount, ${formatPeso(amount)}`}
                                    className="flex-row items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 active:bg-emerald-100"
                                >
                                    <Banknote size={15} color="#065f46" />
                                    <Text className="font-sans-bold text-sm text-emerald-800">Exact amount · {formatPeso(amount)}</Text>
                                </Pressable>
                            </View>
                            <View className="flex-row items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
                                <Text className="font-sans-bold text-base text-slate-500">₱</Text>
                                <TextInput
                                    value={received}
                                    onChangeText={(value) => {
                                        setReceived(value);
                                        setFieldError(null);
                                    }}
                                    keyboardType="decimal-pad"
                                    maxLength={12}
                                    placeholder={(amount / 100).toFixed(2)}
                                    placeholderTextColor="#cbd5e1"
                                    className="h-12 flex-1 font-sans-bold text-lg text-slate-900"
                                />
                            </View>
                            {(cashProblem ?? fieldError) && (
                                <Text className="font-sans-semibold text-sm text-red-600">{cashProblem ?? fieldError}</Text>
                            )}
                            {receivedCentavos !== null && cashProblem === null && (
                                <View className="flex-row items-center justify-between rounded-xl bg-emerald-50 px-3 py-2">
                                    <Text className="font-sans-bold text-sm text-emerald-800">Change</Text>
                                    <Text className="font-sans-bold text-lg text-emerald-800">{formatPeso(change)}</Text>
                                </View>
                            )}
                        </View>
                    )}

                    {method === 'gcash' && (
                        <View className="gap-1.5">
                            <Text className="font-sans-bold text-sm text-slate-700">
                                GCash reference number <Text className="text-red-600">*</Text>
                            </Text>
                            <TextInput
                                value={reference}
                                onChangeText={(value) => {
                                    setReference(value);
                                    setFieldError(null);
                                }}
                                keyboardType="number-pad"
                                maxLength={17}
                                placeholder="13 digits, e.g. 1004 123 456789"
                                placeholderTextColor="#94a3b8"
                                className="h-12 rounded-xl border border-slate-200 bg-white px-3 font-sans-bold text-base tracking-wider text-slate-900"
                            />
                            <Text className="font-sans text-xs text-slate-500">
                                {digits.replace(/\D/g, '').length} of 13 digits. Copy it from the buyer&apos;s GCash receipt.
                            </Text>
                            {(gcashProblem ?? fieldError) && (
                                <Text className="font-sans-semibold text-sm text-red-600">{gcashProblem ?? fieldError}</Text>
                            )}
                        </View>
                    )}

                    <Pressable
                        onPress={confirm}
                        disabled={busy || !ready}
                        accessibilityRole="button"
                        className={`flex-row items-center justify-center gap-2 rounded-2xl bg-brand py-4 ${busy || !ready ? 'opacity-50' : ''}`}
                    >
                        {busy ? <ActivityIndicator color="#ffffff" /> : <Banknote size={18} color="#ffffff" />}
                        <Text className="font-sans-bold text-base text-white">Mark as Paid · {formatPeso(amount)}</Text>
                    </Pressable>
                    <Text className="text-center font-sans-semibold text-xs text-slate-500">
                        {method === '' ? 'Choose the payment method first.' : 'A Payment Receipt is issued.'}
                    </Text>
                </View>
            )}

            {result.receipt && (
                <Pressable
                    onPress={() => router.push({ pathname: '/cashier-receipt/[id]', params: { id: String(result.receipt?.id) } })}
                    accessibilityRole="button"
                    className="flex-row items-center justify-center gap-2 rounded-2xl border border-blue-300 bg-blue-50 py-3.5"
                >
                    <ReceiptText size={18} color="#1d4ed8" />
                    <Text className="font-sans-bold text-base text-blue-700">View Payment Receipt {result.receipt.receipt_number}</Text>
                </Pressable>
            )}

            {result.can_undo && (
                <UndoPayment
                    path={
                        isOrder
                            ? `/cashier/orders/${result.order?.id}/undo-payment`
                            : `/cashier/preorder-slips/${result.slip.slip_id}/undo-payment`
                    }
                    number={number ?? ''}
                    buyer={buyer}
                    isOrder={isOrder}
                    onUndone={(message, next) => {
                        setDone(message);
                        setError(null);

                        if (next) {
                            setResult(next);
                        }
                    }}
                />
            )}

            {!done && !result.can_mark_paid && <ScanButton main onPress={scanNext} label="Scan the next slip" />}
        </Screen>
    );
}

/**
 * Undo a payment recorded by mistake, like the website's: a reason is
 * required (at least 5 characters); the buyer and the Specialist are told.
 */
function UndoPayment({
    path,
    number,
    buyer,
    isOrder,
    onUndone,
}: {
    path: string;
    number: string;
    buyer: string;
    isOrder: boolean;
    onUndone: (message: string, next: CashierLookup | null) => void;
}) {
    const { request } = useAuth();
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const ready = reason.trim().length >= 5;

    const close = (): void => {
        setOpen(false);
        setReason('');
        setError(null);
    };

    const undo = async (): Promise<void> => {
        setBusy(true);
        setError(null);

        try {
            const answer = await request<{ message: string; result: CashierLookup | null }>(path, {
                method: 'POST',
                body: { reason: reason.trim() },
            });
            close();
            onUndone(answer.message, answer.result);
        } catch (caught) {
            setError(caught instanceof ApiError ? caught.message : 'The payment could not be undone. Try again.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <Pressable
                onPress={() => setOpen(true)}
                accessibilityRole="button"
                className="flex-row items-center justify-center gap-2 rounded-2xl border border-red-300 bg-red-50 py-3.5"
            >
                <Undo2 size={18} color="#b91c1c" />
                <Text className="font-sans-bold text-base text-red-700">Undo payment</Text>
            </Pressable>
            <Text className="-mt-2 text-center font-sans-semibold text-xs text-slate-500">
                Recorded by mistake? It can be undone today, before {isOrder ? 'release' : 'the items arrive'}.
            </Text>

            <BottomSheet
                open={open}
                onClose={close}
                unsaved={reason.trim() !== '' && !busy}
                title={`Undo the payment for ${number}?`}
                subtitle={
                    isOrder
                        ? `The Payment Receipt will be voided, the order goes back to waiting for payment, and its reserved items are for sale again. ${buyer} and the Specialist are notified.`
                        : `The Payment Receipt will be voided and the slip goes back to waiting for payment. ${buyer} and the Specialist are notified.`
                }
                icon={<Undo2 size={20} color="#b91c1c" />}
                footer={
                    <View className="flex-row gap-3">
                        <Pressable
                            onPress={close}
                            accessibilityRole="button"
                            className="flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white py-3.5"
                        >
                            <Text className="font-sans-bold text-base text-slate-700">Keep payment</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => void undo()}
                            disabled={busy || !ready}
                            accessibilityRole="button"
                            className={`flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-red-600 py-3.5 ${busy || !ready ? 'opacity-50' : ''}`}
                        >
                            {busy && <ActivityIndicator color="#ffffff" />}
                            <Text className="font-sans-bold text-base text-white">Undo payment</Text>
                        </Pressable>
                    </View>
                }
            >
                <View className="gap-2">
                    <Text className="font-sans-bold text-sm text-slate-700">Reason</Text>
                    <TextInput
                        value={reason}
                        onChangeText={setReason}
                        maxLength={200}
                        multiline
                        placeholder="e.g. Scanned the wrong slip."
                        placeholderTextColor="#94a3b8"
                        className="min-h-[80px] rounded-xl border border-slate-200 bg-white px-3 py-3 font-sans-medium text-sm text-slate-900"
                        style={{ textAlignVertical: 'top' }}
                    />
                    <Text className="font-sans text-xs text-slate-500">At least 5 characters. Kept on record with the payment.</Text>
                    {error && <Text className="font-sans-semibold text-sm text-red-600">{error}</Text>}
                </View>
            </BottomSheet>
        </>
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
