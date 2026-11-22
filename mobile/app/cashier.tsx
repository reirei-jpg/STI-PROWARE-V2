import { router, useFocusEffect } from 'expo-router';
import { ChevronRight, Clock, LogOut, ReceiptText, ScanLine, Search, Wallet, XCircle } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LoadError from '@/components/LoadError';
import { receiptsLink } from '@/components/PaymentPeriodPicker';
import PaymentRowItem from '@/components/PaymentRowItem';
import { loadErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatPeso, receiptCount } from '@/lib/format';
import type { CashierDashboard } from '@/lib/types';

/**
 * The cashier's Dashboard on the phone, like the website's (panel revision,
 * 20 Nov 2026): today's total, Cash and GCash payments, what is awaiting
 * payment, today's voided payments, Scan a slip or enter its number, the
 * cashier's records (Awaiting Payment, Payment History, Collections) and
 * the latest payments.
 */
export default function CashierScreen() {
    const insets = useSafeAreaInsets();
    const { user, request, signOut } = useAuth();
    const [typed, setTyped] = useState('');
    const [dashboard, setDashboard] = useState<CashierDashboard | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(
        () =>
            request<CashierDashboard>('/cashier/dashboard')
                .then((answer) => {
                    setDashboard(answer);
                    setError(null);
                })
                .catch((caught) => setError(loadErrorMessage(caught, 'The dashboard could not be loaded.'))),
        [request],
    );

    // Fresh every time the cashier comes back from a slip or a receipt.
    useFocusEffect(
        useCallback(() => {
            void load();
        }, [load]),
    );

    const pullToRefresh = async (): Promise<void> => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    const openTyped = (): void => {
        if (typed.trim() !== '') {
            router.push({ pathname: '/cashier-slip', params: { code: typed.trim() } });
            setTyped('');
        }
    };

    const confirmSignOut = (): void =>
        Alert.alert('Log out?', 'You can sign in again with your PROWARE email.', [
            { text: 'Stay', style: 'cancel' },
            { text: 'Log out', style: 'destructive', onPress: () => void signOut() },
        ]);

    const today = dashboard?.today;
    const todayPeriod = { period: 'today' as const, date_from: '', date_to: '' };
    const openReceipts = (method: '' | 'cash' | 'gcash', status: '' | 'paid' | 'void'): void => router.push(receiptsLink(todayPeriod, method, status));
    const awaiting = dashboard?.awaiting;

    return (
        <ScrollView
            className="flex-1 bg-page"
            contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32, paddingHorizontal: 16, gap: 16 }}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} />}
        >
            <View className="rounded-3xl bg-brand px-5 py-6">
                <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                        <Text className="font-sans-semibold text-xs uppercase tracking-wide text-blue-100">STI PROWARE · Cashier</Text>
                        <Text className="mt-1 font-sans-bold text-2xl text-white">Dashboard</Text>
                        <Text className="mt-1 font-sans text-sm leading-5 text-blue-50">
                            Hi, {user?.name}. Scan the buyer&apos;s slip, collect the amount due, and record the payment.
                        </Text>
                    </View>
                    <Pressable
                        onPress={confirmSignOut}
                        accessibilityRole="button"
                        accessibilityLabel="Log out"
                        className="h-11 w-11 items-center justify-center rounded-2xl bg-white/15"
                    >
                        <LogOut size={20} color="#ffffff" />
                    </Pressable>
                </View>
            </View>

            {error && <LoadError message={error} onRetry={load} className="" />}

            {/* Until the figures arrive, a dash: never a ₱0.00 that looks real. */}
            <View className="flex-row gap-3">
                <Card label="Total Collected Today" value={today ? formatPeso(today.total_centavos) : '—'} action="View receipts" onPress={() => openReceipts('', 'paid')}>
                    {today ? `${receiptCount(today.count)} issued today` : 'Loading…'}
                </Card>
                <Card label="Awaiting Payment" value={awaiting ? String(awaiting.orders + awaiting.slips) : '—'} action="View list" onPress={() => router.push('/cashier-awaiting')}>
                    {awaiting ? `${formatPeso(awaiting.total_centavos)} in total` : 'Loading…'}
                </Card>
            </View>
            <View className="flex-row gap-3">
                <Card label="Cash Payments" value={today ? formatPeso(today.cash_centavos) : '—'} action="View Cash" onPress={() => openReceipts('cash', 'paid')}>
                    {today ? `${receiptCount(today.cash_count)} today` : 'Loading…'}
                </Card>
                <Card label="GCash Payments" value={today ? formatPeso(today.gcash_centavos) : '—'} action="View GCash" onPress={() => openReceipts('gcash', 'paid')}>
                    {today ? `${receiptCount(today.gcash_count)} today` : 'Loading…'}
                </Card>
            </View>
            {(today?.void_count ?? 0) > 0 && (
                <Pressable
                    onPress={() => openReceipts('', 'void')}
                    accessibilityRole="button"
                    className="flex-row items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3"
                >
                    <XCircle size={18} color="#b91c1c" />
                    <Text className="flex-1 font-sans-semibold text-sm text-red-800">
                        {today?.void_count} {today?.void_count === 1 ? 'voided payment' : 'voided payments'} today ({formatPeso(today?.void_centavos ?? 0)}), not counted in the total.
                    </Text>
                    <Text className="font-sans-bold text-sm text-red-800">View</Text>
                </Pressable>
            )}

            <Pressable
                onPress={() => router.push('/scan-slip')}
                accessibilityRole="button"
                className="flex-row items-center justify-center gap-2 rounded-2xl bg-brand py-4"
            >
                <ScanLine size={20} color="#ffffff" />
                <Text className="font-sans-bold text-base text-white">Scan a slip</Text>
            </Pressable>

            <View className="gap-2 rounded-3xl border border-slate-200 bg-white p-4">
                <Text className="font-sans-bold text-sm text-slate-700">No QR code? Enter the slip number</Text>
                <View className="flex-row gap-2">
                    <TextInput
                        value={typed}
                        onChangeText={setTyped}
                        onSubmitEditing={openTyped}
                        placeholder="e.g. PW-0042 or PR-0003"
                        placeholderTextColor="#94a3b8"
                        autoCapitalize="characters"
                        returnKeyType="search"
                        maxLength={120}
                        className="h-12 flex-1 rounded-xl border border-slate-200 bg-white px-3 font-sans text-base text-slate-900"
                    />
                    <Pressable
                        onPress={openTyped}
                        disabled={typed.trim() === ''}
                        accessibilityRole="button"
                        className={`h-12 flex-row items-center gap-1.5 rounded-xl border border-blue-300 bg-blue-50 px-4 ${typed.trim() === '' ? 'opacity-50' : ''}`}
                    >
                        <Search size={17} color="#1d4ed8" />
                        <Text className="font-sans-bold text-sm text-blue-700">Open</Text>
                    </Pressable>
                </View>
            </View>

            <View className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
                <MenuLink icon={<Clock size={18} color="#1d4ed8" />} label="Awaiting Payment" detail="Who still has to pay; search by name or ID" href="/cashier-awaiting" first />
                <MenuLink icon={<ReceiptText size={18} color="#1d4ed8" />} label="Payment History" detail="Every Payment Receipt, with filters" href="/cashier-history" />
                <MenuLink icon={<Wallet size={18} color="#1d4ed8" />} label="Collections" detail="The money collected by day or month" href="/cashier-collections" />
            </View>

            <View className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
                <View className="flex-row items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                    <Text className="font-sans-bold text-base text-slate-900">Latest payments today</Text>
                </View>
                {dashboard === null ? null : dashboard.latest.length === 0 ? (
                    <Text className="px-4 py-6 text-center font-sans text-sm text-slate-500">No payments have been recorded today.</Text>
                ) : (
                    dashboard.latest.map((row, index) => <PaymentRowItem key={row.id} row={row} first={index === 0} />)
                )}
            </View>
        </ScrollView>
    );
}

function Card({ label, value, action, onPress, children }: { label: string; value: string; action: string; onPress: () => void; children: ReactNode }) {
    return (
        <Pressable onPress={onPress} accessibilityRole="button" className="flex-1 rounded-3xl border border-slate-200 bg-white p-4 active:bg-blue-50">
            <Text className="font-sans-bold text-xs text-slate-500">{label}</Text>
            <Text className="mt-1 font-sans-bold text-xl text-slate-900">{value}</Text>
            <Text className="mt-1 font-sans text-[11px] leading-4 text-slate-500">{children}</Text>
            <View className="mt-2 flex-row items-center gap-0.5">
                <Text className="font-sans-bold text-xs text-blue-700">{action}</Text>
                <ChevronRight size={14} color="#1d4ed8" />
            </View>
        </Pressable>
    );
}

function MenuLink({
    icon,
    label,
    detail,
    href,
    first = false,
}: {
    icon: ReactNode;
    label: string;
    detail: string;
    href: '/cashier-awaiting' | '/cashier-history' | '/cashier-collections';
    first?: boolean;
}) {
    return (
        <Pressable
            onPress={() => router.push(href)}
            accessibilityRole="button"
            className={`flex-row items-center gap-3 px-4 py-3.5 ${first ? '' : 'border-t border-slate-100'}`}
        >
            <View className="h-9 w-9 items-center justify-center rounded-xl bg-blue-50">{icon}</View>
            <View className="flex-1">
                <Text className="font-sans-bold text-sm text-slate-900">{label}</Text>
                <Text className="font-sans text-xs text-slate-500">{detail}</Text>
            </View>
            <ChevronRight size={18} color="#94a3b8" />
        </Pressable>
    );
}
