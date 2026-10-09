import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Ban, CircleCheck, Clock, PackageCheck } from 'lucide-react-native';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import IssuanceSlipCard from '@/components/IssuanceSlipCard';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatPeso } from '@/lib/format';
import type { IssuanceSlipData } from '@/lib/types';

/**
 * The student's issuance slip for an order, like the website's: show it at
 * the PROWARE office, where the Specialist scans its QR, the student pays,
 * and the items are released. Above it, what to do next in V1's colors:
 * amber waiting, green ready or released, red cancelled.
 */
export default function SlipScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const insets = useSafeAreaInsets();
    const { request } = useAuth();
    const [slip, setSlip] = useState<IssuanceSlipData | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async (): Promise<void> => {
        try {
            setSlip(await request<IssuanceSlipData>(`/orders/${id}/slip`));
            setLoadError(null);
        } catch (caught) {
            setLoadError(
                caught instanceof ApiError && caught.status === 404
                    ? 'This order was not found.'
                    : 'The slip could not be loaded. Pull down to try again.',
            );
        }
    }, [id, request]);

    useEffect(() => {
        void load();
    }, [load]);

    // After the Specialist releases it, pulling down shows RELEASED.
    const pullToRefresh = async (): Promise<void> => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

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
                onPress={() => router.back()}
                accessibilityRole="button"
                className="flex-row items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
                <ArrowLeft size={17} color="#334155" />
                <Text className="font-sans-bold text-sm text-slate-700">Back</Text>
            </Pressable>

            {loadError && slip === null ? (
                <Text className="font-sans-semibold text-sm text-red-600">{loadError}</Text>
            ) : slip === null ? (
                <ActivityIndicator color="#0D6EFD" className="mt-10" />
            ) : (
                <>
                    <View>
                        <Text className="font-sans-bold text-2xl text-slate-900">Issuance Slip</Text>
                        <Text className="font-sans text-sm text-slate-500">
                            Order {slip.number}. This is your receipt for the order.
                        </Text>
                    </View>

                    <SlipNextStep slip={slip} />

                    <IssuanceSlipCard slip={slip} />
                </>
            )}
        </ScrollView>
    );
}

function SlipNextStep({ slip }: { slip: IssuanceSlipData }) {
    switch (slip.status) {
        case 'placed':
            return (
                <Notice tone="amber" icon={<Clock size={20} color="#b45309" />}>
                    The PROWARE office is preparing your order. Show this slip there by{' '}
                    <Text className="font-sans-bold">{formatDate(slip.pick_up_by)}</Text>, pay{' '}
                    <Text className="font-sans-bold">{formatPeso(slip.total_centavos)}</Text>, and get
                    your items.
                </Notice>
            );
        case 'ready':
            return (
                <Notice tone="green" icon={<PackageCheck size={20} color="#047857" />}>
                    Your order is ready. Show this slip at the PROWARE office by{' '}
                    <Text className="font-sans-bold">{formatDate(slip.pick_up_by)}</Text>, pay{' '}
                    <Text className="font-sans-bold">{formatPeso(slip.total_centavos)}</Text>, and get
                    your items.
                </Notice>
            );
        case 'picked_up':
            return (
                <Notice tone="green" icon={<CircleCheck size={20} color="#047857" />}>
                    Released on <Text className="font-sans-bold">{formatDate(slip.released_on)}</Text>
                    {slip.issued_by ? ` by ${slip.issued_by}` : ''}. Keep this slip as your receipt.
                </Notice>
            );
        default:
            return (
                <Notice tone="red" icon={<Ban size={20} color="#b91c1c" />}>
                    This order was cancelled, so this slip can no longer be used.
                </Notice>
            );
    }
}

function Notice({
    tone,
    icon,
    children,
}: {
    tone: 'amber' | 'green' | 'red';
    icon: ReactNode;
    children: ReactNode;
}) {
    const classes = {
        amber: ['border-amber-200 bg-amber-50', 'text-amber-900', '#f59e0b'],
        green: ['border-emerald-200 bg-emerald-50', 'text-emerald-900', '#10b981'],
        red: ['border-red-200 bg-red-50', 'text-red-900', '#f87171'],
    }[tone];

    return (
        <View
            style={{ borderLeftWidth: 5, borderLeftColor: classes[2] }}
            className={`flex-row items-start gap-3 rounded-2xl border px-4 py-3 ${classes[0]}`}
        >
            {icon}
            <Text className={`flex-1 font-sans text-sm leading-5 ${classes[1]}`}>{children}</Text>
        </View>
    );
}
