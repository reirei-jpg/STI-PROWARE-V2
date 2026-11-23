import { router } from 'expo-router';
import { ArrowRight, Clock, ReceiptText } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import BottomSheet from '@/components/BottomSheet';
import LoadError from '@/components/LoadError';
import StaffTag from '@/components/StaffTag';
import { loadErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime, formatPeso } from '@/lib/format';
import type { AwaitingRow, Page } from '@/lib/types';

/** How many slips the sheet lists; the rest are on Awaiting Payment. */
const SHOWN = 10;

type Answer = { orders: Page<AwaitingRow>; slips: Page<AwaitingRow> };

/**
 * The pop-up of the Awaiting Payment card on the phone (like V1's "Waiting
 * for Payment"): the orders and preorder slips not paid yet, the oldest
 * first, each with Record Payment, then a button to the whole list. A list
 * that cannot be loaded says why, with Try again.
 */
export default function AwaitingSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { request } = useAuth();
    const [answer, setAnswer] = useState<Answer | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (): Promise<void> => {
        setAnswer(null);
        setError(null);

        try {
            setAnswer(await request<Answer>('/cashier/awaiting'));
        } catch (caught) {
            setError(loadErrorMessage(caught, 'The slips awaiting payment could not be loaded.'));
        }
    }, [request]);

    useEffect(() => {
        if (open) {
            void load();
        }
    }, [open, load]);

    const rows = answer ? [...answer.orders.data, ...answer.slips.data].sort((a, b) => (a.since ?? '').localeCompare(b.since ?? '')).slice(0, SHOWN) : [];
    const waiting = answer ? answer.orders.total + answer.slips.total : 0;

    const go = (to: () => void): void => {
        onClose();
        to();
    };

    return (
        <BottomSheet
            open={open}
            onClose={onClose}
            title="Awaiting Payment"
            subtitle={
                answer
                    ? `${answer.orders.total} ${answer.orders.total === 1 ? 'order' : 'orders'} · ${answer.slips.total} preorder ${answer.slips.total === 1 ? 'slip' : 'slips'}, the oldest first`
                    : error === null
                      ? 'Loading…'
                      : 'Could not load'
            }
            icon={<Clock size={20} color="#1d4ed8" />}
            footer={
                <View className="gap-2">
                    {waiting > rows.length && (
                        <Text className="text-center font-sans text-xs text-slate-500">
                            The {rows.length} waiting the longest are shown, and {waiting - rows.length} more.
                        </Text>
                    )}
                    <Pressable
                        onPress={() => go(() => router.push('/cashier-awaiting'))}
                        accessibilityRole="button"
                        className="flex-row items-center justify-center gap-2 rounded-2xl bg-brand py-3.5"
                    >
                        <Text className="font-sans-bold text-base text-white">View all awaiting</Text>
                        <ArrowRight size={18} color="#ffffff" />
                    </Pressable>
                </View>
            }
        >
            {error ? (
                <LoadError message={error} onRetry={load} className="" />
            ) : answer === null ? (
                <View className="items-center gap-2 py-8">
                    <ActivityIndicator color="#0D6EFD" />
                    <Text className="font-sans text-sm text-slate-500">Loading the slips…</Text>
                </View>
            ) : rows.length === 0 ? (
                <Text className="rounded-2xl border border-slate-200 px-4 py-6 text-center font-sans text-sm text-slate-500">
                    No orders or preorder slips are awaiting payment.
                </Text>
            ) : (
                <View className="overflow-hidden rounded-2xl border border-slate-200">
                    {rows.map((row, index) => (
                        <View key={`${row.kind}-${row.id}`} className={`gap-2 px-4 py-3 ${index > 0 ? 'border-t border-slate-100' : ''}`}>
                            <View className="flex-row items-start justify-between gap-3">
                                <View className="flex-1">
                                    <View className="flex-row flex-wrap items-center gap-1.5">
                                        <Text className="font-sans-bold text-sm text-slate-900">
                                            {row.number} · {row.buyer_name}
                                        </Text>
                                        {row.is_staff && <StaffTag />}
                                    </View>
                                    <Text numberOfLines={1} className="font-sans text-xs text-slate-500">
                                        {row.for}
                                    </Text>
                                    <Text className="font-sans text-xs text-slate-400">
                                        {row.kind === 'order' ? 'Order' : 'Preorder slip'} · since {formatDateTime(row.since)}
                                    </Text>
                                </View>
                                <Text className="font-sans-bold text-sm text-slate-900">{formatPeso(row.amount_centavos)}</Text>
                            </View>
                            <Pressable
                                onPress={() => go(() => router.push({ pathname: '/cashier-slip', params: { code: row.number ?? '' } }))}
                                accessibilityRole="button"
                                className="flex-row items-center justify-center gap-1.5 rounded-xl bg-brand py-2"
                            >
                                <ReceiptText size={15} color="#ffffff" />
                                <Text className="font-sans-bold text-sm text-white">Record Payment</Text>
                            </Pressable>
                        </View>
                    ))}
                </View>
            )}
        </BottomSheet>
    );
}
