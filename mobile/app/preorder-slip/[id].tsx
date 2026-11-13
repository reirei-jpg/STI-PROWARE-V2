import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, CircleCheck, Clock } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import IssuanceSlipCard from '@/components/IssuanceSlipCard';
import LoadError from '@/components/LoadError';
import LoadingState from '@/components/LoadingState';
import { ApiError, loadErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatPeso } from '@/lib/format';
import type { PreorderSlipData } from '@/lib/types';

/**
 * A batch's preorder slip, like the website's: show it at the cashier to
 * pay, then the PROWARE office marks it Paid. Once paid it is stamped PAID
 * and is the buyer's proof of payment. There is no refund after paying.
 */
export default function PreorderSlipScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const insets = useSafeAreaInsets();
    const { request } = useAuth();
    const [slip, setSlip] = useState<PreorderSlipData | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async (): Promise<void> => {
        try {
            setSlip(await request<PreorderSlipData>(`/preorders/slips/${id}`));
            setLoadError(null);
        } catch (caught) {
            setLoadError(
                caught instanceof ApiError && caught.status === 404
                    ? 'This preorder slip was not found.'
                    : loadErrorMessage(caught, 'The slip could not be loaded.'),
            );
        }
    }, [id, request]);

    useEffect(() => {
        void load();
    }, [load]);

    // After the office marks it paid, pulling down shows PAID.
    const pullToRefresh = async (): Promise<void> => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    const paid = slip?.status === 'paid';

    return (
        <ScrollView
            className="flex-1 bg-page"
            contentContainerStyle={{
                paddingTop: insets.top + 12,
                paddingBottom: insets.bottom + 32,
                paddingHorizontal: 16,
                gap: 16,
            }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} />}
        >
            <Pressable
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/orders?show=preorders'))}
                accessibilityRole="button"
                className="flex-row items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
                <ArrowLeft size={17} color="#334155" />
                <Text className="font-sans-bold text-sm text-slate-700">Back</Text>
            </Pressable>

            {loadError && slip === null ? (
                <LoadError message={loadError} onRetry={load} className="" />
            ) : slip === null ? (
                <LoadingState />
            ) : (
                <>
                    <View>
                        <Text className="font-sans-bold text-2xl text-slate-900">Preorder Slip</Text>
                        <Text className="font-sans text-sm text-slate-500">
                            Slip {slip.number} for {slip.product_name}.
                        </Text>
                    </View>

                    <View
                        style={{ borderLeftWidth: 5, borderLeftColor: paid ? '#10b981' : '#f59e0b' }}
                        className={`flex-row items-start gap-3 rounded-2xl border px-4 py-3 ${paid ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}
                    >
                        {paid ? <CircleCheck size={20} color="#047857" /> : <Clock size={20} color="#b45309" />}
                        <Text className={`flex-1 font-sans text-sm leading-5 ${paid ? 'text-emerald-900' : 'text-amber-900'}`}>
                            {paid ? (
                                <>
                                    Paid <Text className="font-sans-bold">{formatPeso(slip.total_centavos)}</Text>
                                    {slip.paid_on ? ` on ${formatDate(slip.paid_on)}` : ''}. Keep this slip: it is
                                    your proof of payment. Show it when you get your items.
                                </>
                            ) : (
                                <>
                                    Pay <Text className="font-sans-bold">{formatPeso(slip.total_centavos)}</Text> at
                                    the cashier: show this slip there. Once you have paid, the PROWARE office marks
                                    it Paid. There is no refund after paying.
                                </>
                            )}
                        </Text>
                    </View>

                    <IssuanceSlipCard
                        slip={{ ...slip, order_id: slip.slip_id, status: 'placed', pick_up_by: null, released_on: null, issued_by: null }}
                        title="PREORDER SLIP"
                        paid={paid}
                    />
                </>
            )}
        </ScrollView>
    );
}