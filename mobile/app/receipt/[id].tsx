import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LoadError from '@/components/LoadError';
import LoadingState from '@/components/LoadingState';
import PaymentReceiptCard from '@/components/PaymentReceiptCard';
import { ApiError, loadErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { PaymentReceipt } from '@/lib/types';

/**
 * The buyer's own Payment Receipt, issued by the cashier: proof of what
 * they paid. Opened from the order or the preorder slip.
 */
export default function BuyerReceiptScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const insets = useSafeAreaInsets();
    const { request } = useAuth();
    const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (): Promise<void> => {
        try {
            setReceipt(await request<PaymentReceipt>(`/my-receipts/${id}`));
            setError(null);
        } catch (caught) {
            setError(
                caught instanceof ApiError && caught.status === 404
                    ? 'This receipt was not found.'
                    : loadErrorMessage(caught, 'The receipt could not be loaded.'),
            );
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
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/orders'))}
                accessibilityRole="button"
                className="flex-row items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
                <ArrowLeft size={17} color="#334155" />
                <Text className="font-sans-bold text-sm text-slate-700">Back</Text>
            </Pressable>

            <Text className="font-sans-bold text-2xl text-slate-900">Payment Receipt</Text>

            {error && receipt === null ? (
                <LoadError message={error} onRetry={load} className="" />
            ) : receipt === null ? (
                <LoadingState />
            ) : (
                <>
                    <Text className="font-sans text-sm text-slate-500">
                        {receipt.row.void
                            ? 'This receipt is VOID: the cashier undid the payment.'
                            : 'Issued by the cashier. Keep it as proof of your payment.'}
                    </Text>
                    <PaymentReceiptCard receipt={receipt} />
                </>
            )}
        </ScrollView>
    );
}
