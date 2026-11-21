import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, CircleCheck, ScanLine } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LoadError from '@/components/LoadError';
import LoadingState from '@/components/LoadingState';
import PaymentReceiptCard from '@/components/PaymentReceiptCard';
import { loadErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { PaymentReceipt } from '@/lib/types';

/**
 * A Payment Receipt on the cashier's phone: right after Mark as Paid (with
 * what was recorded), or opened from the Dashboard or Payment History.
 * Receipts are printed from the website (Payment History).
 */
export default function CashierReceiptScreen() {
    const { id, done } = useLocalSearchParams<{ id: string; done?: string }>();
    const insets = useSafeAreaInsets();
    const { request } = useAuth();
    const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (): Promise<void> => {
        try {
            setReceipt(await request<PaymentReceipt>(`/cashier/receipts/${id}`));
            setError(null);
        } catch (caught) {
            setError(loadErrorMessage(caught, 'The receipt could not be loaded.'));
        }
    }, [id, request]);

    useEffect(() => {
        void load();
    }, [load]);

    return (
        <ScrollView
            className="flex-1 bg-page"
            contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32, paddingHorizontal: 16, gap: 16 }}
        >
            <Pressable
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/cashier'))}
                accessibilityRole="button"
                className="flex-row items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
                <ArrowLeft size={17} color="#334155" />
                <Text className="font-sans-bold text-sm text-slate-700">Back</Text>
            </Pressable>

            {done ? (
                <View className="flex-row items-start gap-3 rounded-3xl bg-emerald-600 p-5">
                    <CircleCheck size={26} color="#ffffff" />
                    <Text className="flex-1 font-sans-bold text-base leading-6 text-white">{done}</Text>
                </View>
            ) : null}

            {error && receipt === null ? (
                <LoadError message={error} onRetry={load} className="" />
            ) : receipt === null ? (
                <LoadingState />
            ) : (
                <>
                    <PaymentReceiptCard receipt={receipt} />
                    <Text className="text-center font-sans text-xs text-slate-500">
                        To print this receipt, open Payment History on the PROWARE website.
                    </Text>
                </>
            )}

            <Pressable
                onPress={() => router.replace('/scan-slip')}
                accessibilityRole="button"
                className="flex-row items-center justify-center gap-2 rounded-2xl bg-brand py-4"
            >
                <ScanLine size={18} color="#ffffff" />
                <Text className="font-sans-bold text-base text-white">Scan the next slip</Text>
            </Pressable>
        </ScrollView>
    );
}
