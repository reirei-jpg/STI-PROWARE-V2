import { router, useFocusEffect } from 'expo-router';
import { Banknote, LogOut, ReceiptText, ScanLine, Search } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LoadError from '@/components/LoadError';
import { loadErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime, formatPeso } from '@/lib/format';
import type { CashierPaidToday } from '@/lib/types';

/**
 * The cashier's home on the phone, like the website's Payments page (panel
 * revision, 20 Nov 2026): Scan a slip with the camera (or type its number)
 * to see what to collect and Mark as paid; below, what was collected today.
 */
export default function CashierScreen() {
    const insets = useSafeAreaInsets();
    const { user, request, signOut } = useAuth();
    const [typed, setTyped] = useState('');
    const [paidToday, setPaidToday] = useState<CashierPaidToday | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(
        () =>
            request<CashierPaidToday>('/cashier/paid-today')
                .then((answer) => {
                    setPaidToday(answer);
                    setError(null);
                })
                .catch((caught) => setError(loadErrorMessage(caught, "Today's payments could not be loaded."))),
        [request],
    );

    // Fresh every time the cashier comes back from a slip.
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
                        <Text className="font-sans-semibold text-xs uppercase tracking-wide text-blue-100">
                            STI PROWARE · Cashier
                        </Text>
                        <Text className="mt-1 font-sans-bold text-2xl text-white">Payments</Text>
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

            {error && <LoadError message={error} onRetry={load} className="" />}

            <View className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
                <View className="flex-row items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                    <View className="flex-row items-center gap-2">
                        <ReceiptText size={18} color="#2563eb" />
                        <Text className="font-sans-bold text-base text-slate-900">Paid today</Text>
                    </View>
                    <Text className="font-sans-bold text-base text-slate-900">
                        {formatPeso(paidToday?.total_centavos ?? 0)}
                    </Text>
                </View>
                {paidToday === null ? null : paidToday.rows.length === 0 ? (
                    <Text className="px-4 py-6 text-center font-sans text-sm text-slate-500">No payments have been recorded today.</Text>
                ) : (
                    paidToday.rows.map((row, index) => (
                        <View
                            key={`${row.kind}-${row.number}`}
                            className={`flex-row items-center gap-3 px-4 py-3 ${index > 0 ? 'border-t border-slate-100' : ''}`}
                        >
                            <View className="h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
                                <Banknote size={17} color="#1d4ed8" />
                            </View>
                            <View className="flex-1">
                                <Text className="font-sans-bold text-sm text-slate-900">
                                    {row.number} · {row.kind === 'order' ? 'Order' : 'Preorder'}
                                </Text>
                                <Text className="font-sans text-xs text-slate-500">
                                    {row.buyer} · {formatDateTime(row.paid_at)}
                                </Text>
                            </View>
                            <Text className="font-sans-bold text-sm text-slate-900">{formatPeso(row.amount_centavos)}</Text>
                        </View>
                    ))
                )}
            </View>
        </ScrollView>
    );
}
